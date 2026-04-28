import { describe, it, expect } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { researchPrograms } from "./research";

/**
 * Build a V3 mock `doGenerate` result. The text is wrapped in the V3
 * `content: [{type:'text', text}]` envelope and `finishReason`/`usage`
 * follow the V3 nested shapes.
 */
function v3Result(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 50,
        text: 50,
        reasoning: undefined,
      },
    },
    warnings: [],
  };
}

describe("researchPrograms", () => {
  it("returns parsed candidates from a structured-output mock", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3Result(
          JSON.stringify({
            programs: [
              {
                kind: "grant",
                provider: "Test Provider",
                program_name: "Test Grant",
                geography_scope: { scope: "EU" },
                eligibility_rules: { trl_range: [3, 7] },
                source: "llm_research",
                confidence: "medium",
              },
            ],
          }),
        ),
    });

    const result = await researchPrograms({
      model,
      org: { country: "AT", sectors: [], legal_form: "GmbH" },
      project: {
        title: "Test Project",
        summary: "A test",
        trl: 5,
        funding_gap: "500000",
      },
      currentCount: 4,
    });
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].program_name).toBe("Test Grant");
  });

  it("returns empty array when model returns malformed JSON, doesn't throw", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => v3Result("not json at all"),
    });

    const result = await researchPrograms({
      model,
      org: { country: "AT", sectors: [], legal_form: null },
      project: { title: "X", summary: null, trl: null, funding_gap: null },
      currentCount: 0,
    });
    expect(result.candidates).toEqual([]);
    expect(result.error).toMatch(/parse/i);
  });

  it("filters out invalid candidates (Zod validation)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3Result(
          JSON.stringify({
            programs: [
              {
                kind: "grant",
                provider: "Good",
                program_name: "G1",
                geography_scope: { scope: "EU" },
                eligibility_rules: {},
                source: "llm_research",
              },
              {
                kind: "weird-kind",
                provider: "Bad",
                program_name: "B1",
              }, // invalid
            ],
          }),
        ),
    });

    const result = await researchPrograms({
      model,
      org: { country: "AT", sectors: [], legal_form: null },
      project: { title: "X", summary: null, trl: null, funding_gap: null },
      currentCount: 0,
    });
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].provider).toBe("Good");
  });
});
