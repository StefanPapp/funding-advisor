import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { gateway } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";

export type Role = "scoring" | "narrative" | "research";

type Resolved = {
  provider: "gateway" | "anthropic" | "openai";
  modelId: string;
  model: LanguageModel;
};

/**
 * Per-role model defaults.
 *
 * The Anthropic direct provider accepts hyphenated IDs (`claude-sonnet-4-6`),
 * while the AI Gateway expects dot-form prefixed with the upstream provider
 * (`anthropic/claude-sonnet-4.6`). Both refer to the same upstream model.
 */
const MODEL_FOR_ROLE: Record<
  Role,
  {
    anthropicDirect: string;
    anthropicGateway: string;
    openaiDirect: string;
    openaiGateway: string;
  }
> = {
  scoring: {
    anthropicDirect: "claude-sonnet-4-6",
    anthropicGateway: "anthropic/claude-sonnet-4.6",
    openaiDirect: "gpt-5",
    openaiGateway: "openai/gpt-5",
  },
  narrative: {
    anthropicDirect: "claude-opus-4-7",
    anthropicGateway: "anthropic/claude-opus-4.7",
    openaiDirect: "gpt-5",
    openaiGateway: "openai/gpt-5",
  },
  research: {
    anthropicDirect: "claude-sonnet-4-6",
    anthropicGateway: "anthropic/claude-sonnet-4.6",
    openaiDirect: "gpt-5",
    openaiGateway: "openai/gpt-5",
  },
};

/**
 * Selects an LLM for the given role using the configured credentials.
 *
 * Resolution order:
 *  1. AI_GATEWAY_API_KEY → Vercel AI Gateway (preferred — auth, routing, failover, cost tracking).
 *  2. ANTHROPIC_API_KEY → direct Anthropic provider (local dev / failover).
 *  3. OPENAI_API_KEY → direct OpenAI provider (local dev / failover).
 *
 * Throws when none of the above are set.
 */
export function selectModel(role: Role): Resolved {
  const cfg = MODEL_FOR_ROLE[role];

  if (process.env.AI_GATEWAY_API_KEY) {
    const modelId = cfg.anthropicGateway;
    return {
      provider: "gateway",
      modelId,
      model: gateway(modelId),
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      modelId: cfg.anthropicDirect,
      model: anthropic(cfg.anthropicDirect),
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      modelId: cfg.openaiDirect,
      model: openai(cfg.openaiDirect),
    };
  }

  throw new Error(
    "No LLM credentials configured. Set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY.",
  );
}
