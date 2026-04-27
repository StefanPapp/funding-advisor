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

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
