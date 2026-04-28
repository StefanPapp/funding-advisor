import { describe, it, expect } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { generateNarrative } from "./narrate";

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

describe("generateNarrative", () => {
  it("returns markdown text from a mock", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3Result(
          "# Funding Strategy\n\nPursue X first.\n\n## Plays\n1. Apply to FFG.",
        ),
    });

    const r = await generateNarrative({
      model,
      org: {
        country: "AT",
        sectors: [],
        legal_form: "GmbH",
        sme_classification: "small",
      },
      project: {
        title: "X",
        summary: null,
        trl: 5,
        funding_gap: "500000",
      },
      ranked: [
        {
          program_id: "p1",
          program_name: "FFG Basisprogramm",
          provider: "FFG",
          kind: "grant",
          score: 85,
          reasoning: "Strong fit",
        },
      ],
    });
    expect(r.narrative).toMatch(/Funding Strategy/);
  });
});
