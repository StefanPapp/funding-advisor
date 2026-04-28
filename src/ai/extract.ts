import { generateText, type LanguageModel } from "ai";
import type { Message } from "@/interview/scripts";

export type ExtractInput = {
  model: LanguageModel;
  subject_type: "org" | "project";
  transcript: Message[];
};

export type ExtractResult = {
  fields: Record<string, unknown>;
  error?: string;
};

const ORG_SCHEMA_HINT = `Allowed fields: legal_name (string), trading_name (string), country (2-letter ISO), region (string), founded_on (YYYY-MM-DD), legal_form (string), employee_count (integer), annual_revenue (decimal string "1234.56"), balance_sheet_total (decimal string), sectors (string array of NACE codes), narrative (string).`;

const PROJECT_SCHEMA_HINT = `Allowed fields: title (string), summary (string), status ("idea"|"planning"|"active"|"seeking_funding"|"funded"), trl (integer 1-9), domain (string array), total_budget (decimal string), funding_gap (decimal string), currency (3-letter ISO), timeline_start (YYYY-MM-DD), timeline_end (YYYY-MM-DD), duration_months (integer), equity_willingness ("none"|"minority"|"majority"), narrative (string).`;

export async function extractFields(input: ExtractInput): Promise<ExtractResult> {
  const { model, subject_type, transcript } = input;

  const schemaHint = subject_type === "org" ? ORG_SCHEMA_HINT : PROJECT_SCHEMA_HINT;
  const systemPrompt = `You extract structured field values from interview transcripts.

${schemaHint}

Respond ONLY with a JSON object whose keys are field names from the allowed list. Include only fields the user clearly answered. Decimal money fields must be strings like "1234.56". Skip uncertain values.`;

  const userPrompt = transcript.map((m) => `${m.role}: ${m.content}`).join("\n");

  const out = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt || "(empty transcript)",
    maxOutputTokens: 1500,
  });

  try {
    const parsed = JSON.parse(out.text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("expected object");
    }
    return { fields: parsed as Record<string, unknown> };
  } catch (err) {
    return { fields: {}, error: `parse: ${err instanceof Error ? err.message : String(err)}` };
  }
}
