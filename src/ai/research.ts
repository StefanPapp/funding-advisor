import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import {
  fundingProgramInsertSchema,
  type FundingProgramInsert,
} from "@/domain/programs";

const researchOutputSchema = z.object({
  programs: z.array(z.unknown()),
});

export type ResearchInput = {
  model: LanguageModel;
  org: {
    country: string | null;
    sectors: string[];
    legal_form: string | null;
  };
  project: {
    title: string;
    summary: string | null;
    trl: number | null;
    funding_gap: string | null;
  };
  currentCount: number;
};

export type ResearchResult = {
  candidates: FundingProgramInsert[];
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
};

const SYSTEM_PROMPT = `You are an expert on EU funding for startups and SMEs. Given an organization and a project, suggest additional EU funding programs (grants, equity, debt, alternative) that match — focusing on programs the user might not already know about.

Respond ONLY with JSON in this exact shape:
{"programs":[{...}, {...}]}

Each program object MUST include: kind ("grant"|"equity"|"debt"|"alternative"), provider, program_name, geography_scope ({scope:"EU"|"national"|"regional", countries?:string[], regions?:string[]}), eligibility_rules ({trl_range?, sme_required?, ...}), source ("llm_research"). Optional: url, sectors, domains, min_amount, max_amount, typical_amount, application_deadline.

Do NOT repeat programs the user already has. Prefer 3–6 specific programs over many vague ones.`;

/**
 * Ask an LLM for additional EU funding program candidates for the given
 * organization and project context. Output is parsed as JSON, validated
 * through `fundingProgramInsertSchema`, and the valid candidates are
 * returned. Malformed JSON is reported via `error` instead of throwing,
 * and individual candidates that fail Zod validation are silently dropped.
 *
 * The caller is responsible for persistence and dedupe against existing
 * programs.
 */
export async function researchPrograms(
  input: ResearchInput,
): Promise<ResearchResult> {
  const { model, org, project, currentCount } = input;

  const userPrompt = `Organization country: ${org.country ?? "unknown"}
Organization legal form: ${org.legal_form ?? "unknown"}
Organization sectors: ${org.sectors.length > 0 ? org.sectors.join(", ") : "unspecified"}
Project: ${project.title}${project.summary ? ` — ${project.summary}` : ""}
TRL: ${project.trl ?? "unknown"}
Funding gap (EUR): ${project.funding_gap ?? "unknown"}
Already in the candidate set: ${currentCount} programs`;

  const out = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: 2000,
  });

  let parsed: { programs: unknown[] };
  try {
    parsed = researchOutputSchema.parse(JSON.parse(out.text));
  } catch (err) {
    return {
      candidates: [],
      error: `parse: ${err instanceof Error ? err.message : String(err)}`,
      promptTokens: out.usage?.inputTokens,
      completionTokens: out.usage?.outputTokens,
    };
  }

  const candidates: FundingProgramInsert[] = [];
  for (const raw of parsed.programs) {
    const r = fundingProgramInsertSchema.safeParse(raw);
    if (r.success) candidates.push(r.data);
  }

  return {
    candidates,
    promptTokens: out.usage?.inputTokens,
    completionTokens: out.usage?.outputTokens,
  };
}
