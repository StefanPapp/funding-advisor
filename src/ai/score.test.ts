import { describe, it, expect } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { scoreCandidates } from "./score";

/**
 * Build a V3 mock `doGenerate` result with one or more tool calls. The V3
 * provider spec requires `input` to be a stringified JSON object.
 */
function v3ToolCallResult(
  calls: Array<{ toolCallId: string; toolName: string; input: object }>,
) {
  return {
    content: calls.map((c) => ({
      type: "tool-call" as const,
      toolCallId: c.toolCallId,
      toolName: c.toolName,
      input: JSON.stringify(c.input),
    })),
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 50,
        text: 0,
        reasoning: undefined,
      },
    },
    warnings: [],
  };
}

function v3TextResult(text: string) {
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
        total: 20,
        text: 20,
        reasoning: undefined,
      },
    },
    warnings: [],
  };
}

const baseOrg = {
  country: "AT",
  sectors: [],
  legal_form: "GmbH",
  sme_classification: "small",
};
const baseProject = {
  title: "X",
  summary: null,
  trl: 5,
  funding_gap: "500000",
};

describe("scoreCandidates", () => {
  it("returns one Score per tool call", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([
          {
            toolCallId: "1",
            toolName: "score",
            input: {
              program_id: "p1",
              score: 80,
              reasoning: "Strong fit on TRL and country.",
            },
          },
          {
            toolCallId: "2",
            toolName: "score",
            input: {
              program_id: "p2",
              score: 40,
              reasoning: "Partial fit; sector mismatch.",
            },
          },
        ]),
    });

    const result = await scoreCandidates({
      model,
      org: baseOrg,
      project: baseProject,
      candidates: [
        { id: "p1", program_name: "FFG Basisprogramm", provider: "FFG", kind: "grant" },
        { id: "p2", program_name: "EIC Accelerator", provider: "EIC", kind: "grant" },
      ],
    });

    expect(result.scores.length).toBe(2);
    expect(result.scores[0]).toEqual({
      program_id: "p1",
      score: 80,
      reasoning: "Strong fit on TRL and country.",
    });
    expect(result.scores[1].program_id).toBe("p2");
    expect(result.scores[1].score).toBe(40);
  });

  it("clamps out-of-range scores to 0..100", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([
          {
            toolCallId: "1",
            toolName: "score",
            input: {
              program_id: "p1",
              score: 150,
              reasoning: "Over-eager.",
            },
          },
        ]),
    });

    const result = await scoreCandidates({
      model,
      org: baseOrg,
      project: baseProject,
      candidates: [
        { id: "p1", program_name: "FFG Basisprogramm", provider: "FFG", kind: "grant" },
      ],
    });

    expect(result.scores.length).toBe(1);
    expect(result.scores[0].score).toBe(100);
  });

  it("returns empty scores when no tool calls are emitted", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => v3TextResult("I don't think these candidates fit."),
    });

    const result = await scoreCandidates({
      model,
      org: baseOrg,
      project: baseProject,
      candidates: [
        { id: "p1", program_name: "FFG Basisprogramm", provider: "FFG", kind: "grant" },
      ],
    });

    expect(result.scores).toEqual([]);
  });
});
