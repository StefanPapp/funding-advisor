import { generateText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { Message, Question } from "@/interview/scripts";

const followupArgs = z.object({ text: z.string() });
const acknowledgeArgs = z.object({ summary: z.string() });

export type ConverseInput = {
  model: LanguageModel;
  question: Question;
  transcript: Message[];
};

export type ConverseResult = {
  kind: "followup" | "acknowledge";
  text: string;
};

const SYSTEM_PROMPT = `You are interviewing a founder to gather precise data for funding-eligibility matching.

For each turn:
- If the user's latest answer is clear and complete for the current question, call emit_acknowledge() with a one-sentence summary, and stop.
- If the answer is ambiguous, partial, or evasive, call emit_followup() with ONE concise clarifying question and stop.
- Always call exactly one of these two tools. Never just write text.

Be warm but efficient. Don't over-explain. Don't congratulate.`;

export async function converseTurn(input: ConverseInput): Promise<ConverseResult> {
  const { model, question, transcript } = input;

  const userPrompt = `Current scripted question: ${question.text}
Target field: ${question.target_field}
Required: ${question.required}

Recent transcript (oldest first):
${transcript
  .slice(-10)
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n")}`;

  let result: ConverseResult = { kind: "acknowledge", text: "" };

  await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    tools: {
      emit_followup: tool({
        description: "Ask one clarifying follow-up question to dig deeper on the current scripted question.",
        inputSchema: followupArgs,
        execute: async (args) => {
          result = { kind: "followup", text: args.text };
          return "ok";
        },
      }),
      emit_acknowledge: tool({
        description: "Acknowledge the user's answer and signal we should move on.",
        inputSchema: acknowledgeArgs,
        execute: async (args) => {
          result = { kind: "acknowledge", text: args.summary };
          return "ok";
        },
      }),
    },
    maxOutputTokens: 500,
  });

  return result;
}
