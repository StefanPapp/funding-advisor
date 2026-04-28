import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { selectModel } from "./models";

const ORIG_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIG_ENV };
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});
afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("selectModel", () => {
  it("uses AI Gateway when AI_GATEWAY_API_KEY is set", () => {
    process.env.AI_GATEWAY_API_KEY = "test-gw";
    const m = selectModel("scoring");
    expect(m.provider).toBe("gateway");
  });

  it("falls back to anthropic direct when gateway not set", () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic";
    const m = selectModel("scoring");
    expect(m.provider).toBe("anthropic");
  });

  it("falls back to openai when only OpenAI key is set", () => {
    process.env.OPENAI_API_KEY = "test-openai";
    const m = selectModel("narrative");
    expect(m.provider).toBe("openai");
  });

  it("throws when no key is configured", () => {
    expect(() => selectModel("scoring")).toThrow(/no LLM credentials/i);
  });

  it("scoring uses Sonnet 4.6 by default", () => {
    process.env.ANTHROPIC_API_KEY = "x";
    const m = selectModel("scoring");
    expect(m.modelId).toMatch(/sonnet/i);
  });

  it("narrative uses Opus 4.7 by default", () => {
    process.env.ANTHROPIC_API_KEY = "x";
    const m = selectModel("narrative");
    expect(m.modelId).toMatch(/opus/i);
  });
});
