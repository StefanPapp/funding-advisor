import { generateText, tool, type LanguageModel } from "ai";
import { z } from "zod";

const scoreArgsSchema = z.object({
  program_id: z.string(),
  score: z.coerce.number(),
  reasoning: z.string(),
});

export type ScoreInput = {
  model: LanguageModel;
  org: {
    country: string | null;
    sectors: string[];
    legal_form: string | null;
    sme_classification: string;
  };
  project: {
    title: string;
    summary: string | null;
    trl: number | null;
    funding_gap: string | null;
  };
  candidates: Array<{
    id: string;
    program_name: string;
    provider: string;
    kind: string;
  }>;
};

export type Score = {
  program_id: string;
  score: number;
  reasoning: string;
};

export type ScoreResult = {
  scores: Score[];
  promptTokens?: number;
  completionTokens?: number;
};

const SYSTEM_PROMPT = `You evaluate funding-program fit for a specific (organization, project) pair. For each candidate program, call the score() tool ONCE with:
- program_id: from the candidates list
- score: 0–100 integer where 100 = perfect fit, 0 = no fit
- reasoning: one sentence explaining the score

Score every candidate. Be specific and grounded.`;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Ask an LLM to score each candidate program for fit against the given
 * organization/project. The model is expected to call the `score()` tool
 * once per candidate. We collect every valid call, clamp scores into
 * 0..100, and return the resulting array. Invalid tool-call arguments
 * are silently dropped.
 */
export async function scoreCandidates(
  input: ScoreInput,
): Promise<ScoreResult> {
  const { model, org, project, candidates } = input;

  const userPrompt = `Organization: country=${org.country ?? "?"}, sme=${org.sme_classification}, legal_form=${org.legal_form ?? "?"}
Project: ${project.title} (TRL ${project.trl ?? "?"}, gap €${project.funding_gap ?? "?"})

Candidates:
${candidates.map((c) => `- ${c.id}: ${c.program_name} (${c.kind}, by ${c.provider})`).join("\n")}`;

  const collected: Score[] = [];

  const out = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    tools: {
      score: tool({
        description:
          "Record a 0-100 fit score with one-sentence reasoning for a candidate program.",
        inputSchema: scoreArgsSchema,
        execute: async (args) => {
          collected.push({
            program_id: args.program_id,
            score: clamp(args.score),
            reasoning: args.reasoning,
          });
          return "recorded";
        },
      }),
    },
    maxOutputTokens: 4000,
  });

  return {
    scores: collected,
    promptTokens: out.usage?.inputTokens,
    completionTokens: out.usage?.outputTokens,
  };
}
