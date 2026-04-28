import { generateText, type LanguageModel } from "ai";

export type NarrateInput = {
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
  ranked: Array<{
    program_id: string;
    program_name: string;
    provider: string;
    kind: string;
    score: number;
    reasoning: string;
  }>;
};

export type NarrateResult = {
  narrative: string;
  promptTokens?: number;
  completionTokens?: number;
};

const SYSTEM_PROMPT = `You write concise, specific funding strategies for early-stage companies. Output GitHub-flavored markdown with three sections:

# Funding strategy for {project}

## Plays
Three numbered plays. Each: program name, € amount target, 1-sentence rationale, sequencing note (now / Q3 / parallel / deprioritized).

## Sequencing
What to do first, what in parallel, what to deprioritize. Reference plays by number.

## Gaps
Up to 3 fields the org/project should fill in to qualify for additional programs.

Be specific about sums, deadlines, and sequencing. No filler. No disclaimers.`;

/**
 * Ask an LLM to write a funding-strategy narrative in markdown for the
 * given (org, project, ranked candidates) tuple. Returns the raw markdown
 * plus token usage.
 */
export async function generateNarrative(
  input: NarrateInput,
): Promise<NarrateResult> {
  const { model, org, project, ranked } = input;

  const userPrompt = `Org: country=${org.country ?? "?"}, sme=${org.sme_classification}, legal_form=${org.legal_form ?? "?"}
Project: ${project.title}${project.summary ? ` — ${project.summary}` : ""}
TRL: ${project.trl ?? "?"}, funding gap: €${project.funding_gap ?? "?"}

Top scored candidates (descending):
${ranked
  .slice(0, 8)
  .map(
    (r) =>
      `- [${r.score}] ${r.program_name} (${r.kind}, ${r.provider}) — ${r.reasoning}`,
  )
  .join("\n")}

Draft the strategy.`;

  const out = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: 2000,
  });

  return {
    narrative: out.text,
    promptTokens: out.usage?.inputTokens,
    completionTokens: out.usage?.outputTokens,
  };
}
