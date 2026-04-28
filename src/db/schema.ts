import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  pgEnum,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const smeClassEnum = pgEnum("sme_class", [
  "micro",
  "small",
  "medium",
  "large",
  "unknown",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "idea",
  "planning",
  "active",
  "seeking_funding",
  "funded",
]);

export const equityWillingnessEnum = pgEnum("equity_willingness", [
  "none",
  "minority",
  "majority",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legal_name: text("legal_name").notNull(),
    trading_name: text("trading_name"),
    country: text("country").notNull(),
    region: text("region"),
    founded_on: date("founded_on"),
    legal_form: text("legal_form"),
    employee_count: integer("employee_count"),
    annual_revenue: numeric("annual_revenue", { precision: 14, scale: 2 }),
    balance_sheet_total: numeric("balance_sheet_total", { precision: 14, scale: 2 }),
    sme_classification: smeClassEnum("sme_classification").notNull().default("unknown"),
    sectors: text("sectors").array().notNull().default(sql`'{}'::text[]`),
    narrative: text("narrative"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    countryCheck: check("organizations_country_iso2", sql`length(${t.country}) = 2`),
  })
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    summary: text("summary"),
    status: projectStatusEnum("status").notNull().default("idea"),
    trl: integer("trl"),
    domain: text("domain").array().notNull().default(sql`'{}'::text[]`),
    total_budget: numeric("total_budget", { precision: 14, scale: 2 }),
    funding_gap: numeric("funding_gap", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("EUR"),
    timeline_start: date("timeline_start"),
    timeline_end: date("timeline_end"),
    duration_months: integer("duration_months"),
    consortium_partners: jsonb("consortium_partners").notNull().default(sql`'[]'::jsonb`),
    equity_willingness: equityWillingnessEnum("equity_willingness"),
    narrative: text("narrative"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    trlCheck: check("projects_trl_range", sql`${t.trl} IS NULL OR (${t.trl} BETWEEN 1 AND 9)`),
    currencyCheck: check("projects_currency_iso", sql`length(${t.currency}) = 3`),
    orgIdx: index("projects_organization_id_idx").on(t.organization_id),
  })
);

export const programKindEnum = pgEnum("program_kind", [
  "grant",
  "equity",
  "debt",
  "alternative",
]);

export const programSourceEnum = pgEnum("program_source", ["seed", "llm_research"]);
export const programConfidenceEnum = pgEnum("program_confidence", ["high", "medium", "low"]);

export const funding_programs = pgTable(
  "funding_programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: programKindEnum("kind").notNull(),
    provider: text("provider").notNull(),
    program_name: text("program_name").notNull(),
    url: text("url"),
    geography_scope: jsonb("geography_scope").notNull(),
    sectors: text("sectors").array().notNull().default(sql`'{}'::text[]`),
    domains: text("domains").array().notNull().default(sql`'{}'::text[]`),
    min_amount: numeric("min_amount", { precision: 14, scale: 2 }),
    max_amount: numeric("max_amount", { precision: 14, scale: 2 }),
    typical_amount: numeric("typical_amount", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("EUR"),
    eligibility_rules: jsonb("eligibility_rules").notNull(),
    application_deadline: date("application_deadline"),
    source: programSourceEnum("source").notNull(),
    last_verified_at: timestamp("last_verified_at", { withTimezone: true }).notNull().defaultNow(),
    confidence: programConfidenceEnum("confidence").notNull().default("medium"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    currencyCheck: check("funding_programs_currency_iso", sql`length(${t.currency}) = 3`),
    providerNameUq: uniqueIndex("funding_programs_provider_program_name_uq").on(
      t.provider,
      t.program_name
    ),
    kindIdx: index("funding_programs_kind_idx").on(t.kind),
  })
);

export const strategy_reports = pgTable("strategy_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  model_used: text("model_used").notNull(),
  input_snapshot: jsonb("input_snapshot").notNull(),
  narrative: text("narrative").notNull(),
  summary: jsonb("summary").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index("strategy_reports_project_id_idx").on(t.project_id),
}));

export const eligibility_results = pgTable("eligibility_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  report_id: uuid("report_id")
    .notNull()
    .references(() => strategy_reports.id, { onDelete: "cascade" }),
  program_id: uuid("program_id")
    .notNull()
    .references(() => funding_programs.id, { onDelete: "restrict" }),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  flags: jsonb("flags").notNull(),
  reasoning: text("reasoning"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  scoreCheck: check("eligibility_results_score_range", sql`${t.score} >= 0 AND ${t.score} <= 100`),
  reportIdx: index("eligibility_results_report_id_idx").on(t.report_id),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type FundingProgram = typeof funding_programs.$inferSelect;
export type NewFundingProgram = typeof funding_programs.$inferInsert;
export type StrategyReport = typeof strategy_reports.$inferSelect;
export type NewStrategyReport = typeof strategy_reports.$inferInsert;
export type EligibilityResultRow = typeof eligibility_results.$inferSelect;
export type NewEligibilityResultRow = typeof eligibility_results.$inferInsert;
