import { z } from "zod";

export const programKind = z.enum(["grant", "equity", "debt", "alternative"]);
export const programSource = z.enum(["seed", "llm_research"]);
export const programConfidence = z.enum(["high", "medium", "low"]);

export const geographyScopeSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("EU"),
    countries: z.array(z.string().length(2)).optional(),
    regions: z.array(z.string()).optional(),
  }),
  z.object({
    scope: z.literal("national"),
    countries: z.array(z.string().length(2)).min(1),
    regions: z.array(z.string()).optional(),
  }),
  z.object({
    scope: z.literal("regional"),
    countries: z.array(z.string().length(2)).min(1),
    regions: z.array(z.string()).min(1),
  }),
]);

const trlTuple = z
  .tuple([z.number().int().min(1).max(9), z.number().int().min(1).max(9)])
  .refine(([min, max]) => min <= max, { message: "trl_range min must be <= max" });

export const eligibilityRulesSchema = z
  .object({
    trl_range: trlTuple.optional(),
    sme_required: z.boolean().optional(),
    consortium_required: z.boolean().optional(),
    legal_forms: z.array(z.string()).optional(),
    age_max_years: z.number().int().min(0).optional(),
    notes: z.string().optional(),
  })
  .strict();

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal with up to 2 fractional digits")
  .optional();

export const fundingProgramInsertSchema = z
  .object({
    kind: programKind,
    provider: z.string().min(1),
    program_name: z.string().min(1),
    url: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
    geography_scope: geographyScopeSchema,
    sectors: z.array(z.string().min(1)).default([]),
    domains: z.array(z.string().min(1)).default([]),
    min_amount: moneyString,
    max_amount: moneyString,
    typical_amount: moneyString,
    currency: z.string().length(3).default("EUR"),
    eligibility_rules: eligibilityRulesSchema,
    application_deadline: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional()
    ),
    source: programSource,
    confidence: programConfidence.optional(),
  })
  .strict();

export type FundingProgramInsert = z.infer<typeof fundingProgramInsertSchema>;
export type GeographyScope = z.infer<typeof geographyScopeSchema>;
export type EligibilityRules = z.infer<typeof eligibilityRulesSchema>;
