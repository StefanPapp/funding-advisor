import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const moneyString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal with up to 2 fractional digits")
    .optional()
);

export const consortiumPartnerSchema = z.object({
  name: z.string().min(1),
  country: z.string().length(2),
  role: z.string().min(1),
});

export const orgInsertSchema = z
  .object({
    legal_name: z.string().min(1),
    trading_name: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    country: z.string().length(2),
    region: z.preprocess(emptyToUndefined, z.string().optional()),
    founded_on: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    legal_form: z.preprocess(emptyToUndefined, z.string().optional()),
    employee_count: z.coerce.number().int().min(0).optional(),
    annual_revenue: moneyString,
    balance_sheet_total: moneyString,
    sectors: z.array(z.string().min(1)).default([]),
    narrative: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .strict();

export type OrgInsert = z.infer<typeof orgInsertSchema>;

export const projectStatusEnum = z.enum([
  "idea",
  "planning",
  "active",
  "seeking_funding",
  "funded",
]);
export const equityWillingnessEnum = z.enum(["none", "minority", "majority"]);

export const projectInsertSchema = z
  .object({
    organization_id: z.guid(),
    title: z.string().min(1),
    summary: z.preprocess(emptyToUndefined, z.string().optional()),
    status: projectStatusEnum.default("idea"),
    trl: z.coerce.number().int().min(1).max(9).optional(),
    domain: z.array(z.string().min(1)).default([]),
    total_budget: moneyString,
    funding_gap: moneyString,
    currency: z.string().length(3).default("EUR"),
    timeline_start: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    timeline_end: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    duration_months: z.coerce.number().int().min(1).optional(),
    consortium_partners: z.array(consortiumPartnerSchema).default([]),
    equity_willingness: z.preprocess(emptyToUndefined, equityWillingnessEnum.optional()),
    narrative: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .strict()
  .refine(
    (v) =>
      !v.total_budget ||
      !v.funding_gap ||
      Number(v.funding_gap) <= Number(v.total_budget),
    { message: "funding_gap cannot exceed total_budget", path: ["funding_gap"] }
  );

export type ProjectInsert = z.infer<typeof projectInsertSchema>;
