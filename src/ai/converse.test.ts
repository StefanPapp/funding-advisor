import { describe, it, expect } from "vitest";
import { converseTurn } from "./converse";
import { MockLanguageModelV3 } from "ai/test";

function v3ToolCallResult(calls: Array<{ id: string; name: string; args: object }>) {
  return {
    content: calls.map((c) => ({
      type: "tool-call" as const,
      toolCallId: c.id,
      toolName: c.name,
      input: JSON.stringify(c.args),
    })),
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

function v3TextResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

const baseQuestion = { id: "legal_form", text: "What's the legal form?", target_field: "legal_form", required: true };

describe("converseTurn", () => {
  it("recognizes a follow-up tool call", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([{ id: "1", name: "emit_followup", args: { text: "Could you specify GmbH or AG?" } }]),
    });
    const r = await converseTurn({
      model,
      question: baseQuestion,
      transcript: [{ role: "user", content: "we're a company" }],
    });
    expect(r.kind).toBe("followup");
    expect(r.text).toBe("Could you specify GmbH or AG?");
  });

  it("recognizes an acknowledge tool call", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([{ id: "1", name: "emit_acknowledge", args: { summary: "Got it — GmbH." } }]),
    });
    const r = await converseTurn({
      model,
      question: baseQuestion,
      transcript: [{ role: "user", content: "GmbH" }],
    });
    expect(r.kind).toBe("acknowledge");
    expect(r.text).toBe("Got it — GmbH.");
  });

  it("falls back to acknowledge with empty text when neither tool fires", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => v3TextResult("I'm a teapot"),
    });
    const r = await converseTurn({
      model,
      question: baseQuestion,
      transcript: [{ role: "user", content: "x" }],
    });
    expect(r.kind).toBe("acknowledge");
    expect(r.text).toBe("");
  });
});
