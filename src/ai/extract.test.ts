import { describe, it, expect } from "vitest";
import { extractFields } from "./extract";
import { MockLanguageModelV3 } from "ai/test";

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

describe("extractFields (org)", () => {
  it("extracts org fields from transcript", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3TextResult(JSON.stringify({ legal_form: "GmbH", employee_count: 12, annual_revenue: "850000.00" })),
    });
    const r = await extractFields({
      model,
      subject_type: "org",
      transcript: [
        { role: "assistant", content: "Legal form?" },
        { role: "user", content: "GmbH" },
        { role: "assistant", content: "Headcount and revenue?" },
        { role: "user", content: "12 people, €850k revenue last year" },
      ],
    });
    expect(r.fields).toEqual({ legal_form: "GmbH", employee_count: 12, annual_revenue: "850000.00" });
  });

  it("returns empty object on malformed JSON", async () => {
    const model = new MockLanguageModelV3({ doGenerate: async () => v3TextResult("not json") });
    const r = await extractFields({ model, subject_type: "org", transcript: [] });
    expect(r.fields).toEqual({});
    expect(r.error).toMatch(/parse/i);
  });
});

describe("extractFields (project)", () => {
  it("extracts project fields", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3TextResult(JSON.stringify({ trl: 5, total_budget: "1000000.00", equity_willingness: "minority" })),
    });
    const r = await extractFields({
      model,
      subject_type: "project",
      transcript: [{ role: "user", content: "TRL 5, €1M budget, OK with minority equity" }],
    });
    expect(r.fields.trl).toBe(5);
  });
});
