# Plan B — Catalog & Eligibility Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a `funding_programs` catalog (seeded with ~15 well-known EU programs), a deterministic eligibility filter (pure TS, TDD), `/catalog` browse UI, and a "Quick match" panel on the project detail page that runs the filter live. End state: the user can compare any project against the seed catalog and see per-program eligibility flags without any LLM involvement.

**Architecture:** Pure-function eligibility filter with no I/O lives in `src/matchmaker/`. Seed catalog lives in `src/db/seeds/programs.ts` as idempotent TS upsert. Server actions in `src/server/programs.ts` mirror the orgs/projects pattern. Two new pages (`/catalog`, `/catalog/[id]`) and one new panel (project detail page).

**Tech Stack:** Same as Plan A — Next.js 16, Drizzle, Postgres, Tailwind, shadcn, Zod, Vitest, Playwright. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-04-27-funding-advisor-design.md` — sections "Data model → funding_programs", "Matchmaking algorithm § 4.1 Eligibility filter", "UI structure → /catalog".

**Branch:** `feat/catalog-eligibility` off `main`.

**Important — APIs change.** Same caveat as Plan A — verify against current docs if a command fails. Doc links inline per task.

---

## Task 0: Branch off main

- [ ] **Step 1: Sync main and branch off**

```bash
git checkout main && git pull --ff-only origin main
git fetch --prune
git checkout -b feat/catalog-eligibility
```

Expected: clean tree, on `feat/catalog-eligibility`. The remote `feat/bootstrap-crud` ref will disappear after `--prune`.

---

## Task 1: Drizzle schema for `funding_programs` + migration

**Files:**
- Modify: `src/db/schema.ts` — add the table at the end
- Create: `src/db/migrations/0001_*.sql` (auto-generated)

**Docs:** https://orm.drizzle.team/docs/sql-schema-declaration

- [ ] **Step 1: Append to `src/db/schema.ts`** (after the `projects` block, before the type exports)

```ts
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

export type FundingProgram = typeof funding_programs.$inferSelect;
export type NewFundingProgram = typeof funding_programs.$inferInsert;
```

Add `uniqueIndex` to the existing import from `drizzle-orm/pg-core` if not already there.

- [ ] **Step 2: Generate migration**

```bash
bun run db:generate
```

Expected: `src/db/migrations/0001_<adjective>_<noun>.sql` appears. Inspect — should `CREATE TYPE program_kind`, `CREATE TYPE program_source`, `CREATE TYPE program_confidence`, `CREATE TABLE funding_programs`, plus the unique index on `(provider, program_name)` and the kind index.

- [ ] **Step 3: Apply locally**

In a non-TTY environment `db:push` errors. Use `db:migrate` (which doesn't prompt) OR pipe SQL directly:

```bash
bun run db:migrate
# OR if that fails:
docker compose exec -T db psql -U dev -d funding_advisor < src/db/migrations/0001_*.sql
```

- [ ] **Step 4: Verify**

```bash
docker compose exec -T db psql -U dev -d funding_advisor -c '\d funding_programs'
```

Expected: 18 columns, unique index, kind index, FK absent (it's a top-level table).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add funding_programs table with constraints"
```

---

## Task 2: Zod schema for `FundingProgram` (TDD)

**Files:**
- Create: `src/domain/programs.ts`, `src/domain/programs.test.ts`

This Zod schema validates the shape of a program at every entry point: seed data, future LLM research output (Plan C), and admin edits (out of scope here). It's deliberately stricter than the Drizzle schema.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/programs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fundingProgramInsertSchema } from "./programs";

const minimal = {
  kind: "grant",
  provider: "FFG",
  program_name: "Basisprogramm",
  geography_scope: { scope: "national", countries: ["AT"] },
  eligibility_rules: {},
  source: "seed",
};

describe("fundingProgramInsertSchema", () => {
  it("accepts a minimal valid program", () => {
    const r = fundingProgramInsertSchema.safeParse(minimal);
    expect(r.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const r = fundingProgramInsertSchema.safeParse({ ...minimal, kind: "weird" });
    expect(r.success).toBe(false);
  });

  it("rejects geography_scope without scope discriminator", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      geography_scope: { countries: ["AT"] },
    });
    expect(r.success).toBe(false);
  });

  it("accepts EU-wide geography (countries optional)", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      geography_scope: { scope: "EU" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts trl_range tuple in eligibility_rules", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      eligibility_rules: { trl_range: [5, 9] },
    });
    expect(r.success).toBe(true);
  });

  it("rejects trl_range with min > max", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      eligibility_rules: { trl_range: [9, 5] },
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown source", () => {
    const r = fundingProgramInsertSchema.safeParse({ ...minimal, source: "manual" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure (module not found)**

```bash
bun run test src/domain/programs.test.ts
```

- [ ] **Step 3: Implement `src/domain/programs.ts`**

```ts
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
```

- [ ] **Step 4: Run — expect 7 passed**

```bash
bun run test src/domain/programs.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): add Zod schema for funding programs"
```

---

## Task 3: Seed catalog + idempotent runner

**Files:**
- Create: `src/db/seeds/programs.ts`, `src/db/seeds/run.ts`
- Modify: `package.json` (add `db:seed` script)

The seed runner upserts by `(provider, program_name)` so re-running is safe. Per your `database.md` rules, seeds live in `db/seeds/` as idempotent TS scripts.

- [ ] **Step 1: Write the seed data**

Create `src/db/seeds/programs.ts`:

```ts
import type { FundingProgramInsert } from "@/domain/programs";

export const seedPrograms: FundingProgramInsert[] = [
  // ── Grants — EU-wide ───────────────────────────────────────────────
  {
    kind: "grant",
    provider: "European Innovation Council",
    program_name: "EIC Accelerator",
    url: "https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: ["deeptech", "climate", "healthtech"],
    min_amount: "500000.00",
    max_amount: "2500000.00",
    typical_amount: "2500000.00",
    eligibility_rules: { trl_range: [5, 9], sme_required: true },
    source: "seed",
    confidence: "high",
  },
  {
    kind: "grant",
    provider: "European Innovation Council",
    program_name: "EIC Pathfinder",
    url: "https://eic.ec.europa.eu/eic-funding-opportunities/eic-pathfinder_en",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: ["deeptech"],
    min_amount: "1000000.00",
    max_amount: "4000000.00",
    eligibility_rules: { trl_range: [1, 4], consortium_required: true },
    source: "seed",
    confidence: "high",
  },
  {
    kind: "grant",
    provider: "European Commission",
    program_name: "Horizon Europe — Pillar 2 Cluster 5 Climate",
    url: "https://ec.europa.eu/info/research-and-innovation/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: ["climate", "energy"],
    min_amount: "2000000.00",
    max_amount: "10000000.00",
    eligibility_rules: { trl_range: [4, 7], consortium_required: true },
    source: "seed",
    confidence: "high",
  },
  {
    kind: "grant",
    provider: "EIT Climate-KIC",
    program_name: "Climate-KIC Accelerator",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: ["climate"],
    min_amount: "20000.00",
    max_amount: "100000.00",
    eligibility_rules: { trl_range: [3, 7], sme_required: true, age_max_years: 7 },
    source: "seed",
    confidence: "high",
  },

  // ── Grants — Austria ───────────────────────────────────────────────
  {
    kind: "grant",
    provider: "FFG",
    program_name: "Basisprogramm",
    url: "https://www.ffg.at/programm/basisprogramm",
    geography_scope: { scope: "national", countries: ["AT"] },
    sectors: [],
    domains: [],
    min_amount: "100000.00",
    max_amount: "3000000.00",
    eligibility_rules: { trl_range: [3, 8] },
    source: "seed",
    confidence: "high",
  },
  {
    kind: "grant",
    provider: "aws",
    program_name: "PreSeed | Seedfinancing — Innovative Solutions",
    url: "https://www.aws.at/aws-preseed-seedfinancing-innovative-solutions/",
    geography_scope: { scope: "national", countries: ["AT"] },
    sectors: [],
    domains: ["deeptech"],
    min_amount: "200000.00",
    max_amount: "800000.00",
    eligibility_rules: { sme_required: true, age_max_years: 5, legal_forms: ["GmbH", "AG"] },
    source: "seed",
    confidence: "high",
  },
  {
    kind: "grant",
    provider: "aws",
    program_name: "Innovation Voucher",
    geography_scope: { scope: "national", countries: ["AT"] },
    sectors: [],
    domains: [],
    min_amount: "5000.00",
    max_amount: "12500.00",
    eligibility_rules: { sme_required: true },
    source: "seed",
    confidence: "high",
  },

  // ── Grants — Germany ───────────────────────────────────────────────
  {
    kind: "grant",
    provider: "BMWK",
    program_name: "EXIST-Forschungstransfer",
    geography_scope: { scope: "national", countries: ["DE"] },
    sectors: [],
    domains: ["deeptech"],
    min_amount: "100000.00",
    max_amount: "300000.00",
    eligibility_rules: { trl_range: [3, 6] },
    source: "seed",
    confidence: "high",
  },
  {
    kind: "grant",
    provider: "BMBF",
    program_name: "KMU-innovativ",
    geography_scope: { scope: "national", countries: ["DE"] },
    sectors: [],
    domains: [],
    min_amount: "100000.00",
    max_amount: "2500000.00",
    eligibility_rules: { trl_range: [3, 7], sme_required: true },
    source: "seed",
    confidence: "high",
  },

  // ── Equity — EU/DACH-active ────────────────────────────────────────
  {
    kind: "equity",
    provider: "Speedinvest",
    program_name: "Pre-seed / Seed",
    url: "https://www.speedinvest.com/",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: ["fintech", "saas", "deeptech"],
    min_amount: "300000.00",
    max_amount: "3000000.00",
    typical_amount: "1500000.00",
    eligibility_rules: {},
    source: "seed",
    confidence: "high",
  },
  {
    kind: "equity",
    provider: "EIT InnoEnergy",
    program_name: "Highway Investment",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: ["energy", "climate"],
    min_amount: "200000.00",
    max_amount: "5000000.00",
    eligibility_rules: { age_max_years: 7 },
    source: "seed",
    confidence: "medium",
  },
  {
    kind: "equity",
    provider: "European Investment Fund",
    program_name: "InvestEU SME Window — Equity",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: [],
    min_amount: "500000.00",
    max_amount: "15000000.00",
    eligibility_rules: { sme_required: true },
    source: "seed",
    confidence: "high",
  },

  // ── Debt — EU/DACH ─────────────────────────────────────────────────
  {
    kind: "debt",
    provider: "European Investment Bank",
    program_name: "Venture Debt",
    geography_scope: { scope: "EU" },
    sectors: [],
    domains: [],
    min_amount: "5000000.00",
    max_amount: "50000000.00",
    eligibility_rules: { sme_required: false },
    source: "seed",
    confidence: "high",
  },
  {
    kind: "debt",
    provider: "aws",
    program_name: "ERP-Kredit",
    geography_scope: { scope: "national", countries: ["AT"] },
    sectors: [],
    domains: [],
    min_amount: "100000.00",
    max_amount: "30000000.00",
    eligibility_rules: { sme_required: true },
    source: "seed",
    confidence: "high",
  },

  // ── Alternative ────────────────────────────────────────────────────
  {
    kind: "alternative",
    provider: "Conda",
    program_name: "Crowdfinanzierung",
    geography_scope: { scope: "EU", countries: ["AT", "DE"] },
    sectors: [],
    domains: [],
    min_amount: "50000.00",
    max_amount: "5000000.00",
    eligibility_rules: { age_max_years: 10 },
    source: "seed",
    confidence: "medium",
  },
];
```

- [ ] **Step 2: Write the runner**

Create `src/db/seeds/run.ts`:

```ts
import { db } from "@/db/client";
import { funding_programs } from "@/db/schema";
import { fundingProgramInsertSchema } from "@/domain/programs";
import { seedPrograms } from "./programs";
import { sql } from "drizzle-orm";

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const raw of seedPrograms) {
    const v = fundingProgramInsertSchema.parse(raw);
    const result = await db
      .insert(funding_programs)
      .values({
        ...v,
        application_deadline: v.application_deadline?.toISOString().slice(0, 10),
        last_verified_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [funding_programs.provider, funding_programs.program_name],
        set: {
          kind: v.kind,
          url: v.url,
          geography_scope: v.geography_scope,
          sectors: v.sectors,
          domains: v.domains,
          min_amount: v.min_amount,
          max_amount: v.max_amount,
          typical_amount: v.typical_amount,
          currency: v.currency,
          eligibility_rules: v.eligibility_rules,
          application_deadline: v.application_deadline?.toISOString().slice(0, 10),
          confidence: v.confidence ?? "medium",
          last_verified_at: new Date(),
          updated_at: new Date(),
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (result[0]?.inserted) inserted++;
    else updated++;
  }
  console.log(`Seed complete: ${inserted} inserted, ${updated} updated`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Add `db:seed` script** to `package.json`:

```json
"db:seed": "bun run src/db/seeds/run.ts"
```

- [ ] **Step 4: Run it**

```bash
bun run db:seed
```

Expected: `Seed complete: 15 inserted, 0 updated`. Re-run: `0 inserted, 15 updated`.

- [ ] **Step 5: Verify in DB**

```bash
docker compose exec -T db psql -U dev -d funding_advisor -c "SELECT kind, count(*) FROM funding_programs GROUP BY kind ORDER BY kind"
```

Expected: 1 alternative, 2 debt, 3 equity, 9 grant.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): seed funding_programs catalog with 15 EU programs"
```

---

## Task 4: Eligibility filter (TDD, pure)

**Files:**
- Create: `src/matchmaker/eligibility.ts`, `src/matchmaker/eligibility.test.ts`

This is the heart of Plan B. A pure function that takes `(Organization, Project, FundingProgram[])` and returns per-program flags. Each per-criterion check is its own small function, exported for direct testing.

- [ ] **Step 1: Write the failing tests**

Create `src/matchmaker/eligibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  checkGeography,
  checkSector,
  checkSme,
  checkTrl,
  checkAmount,
  checkDeadline,
  checkLegalForm,
  checkEquity,
  evaluate,
  type FlagState,
} from "./eligibility";
import type { GeographyScope, EligibilityRules } from "@/domain/programs";

describe("checkGeography", () => {
  it("EU scope: any EU country passes", () => {
    expect(checkGeography("AT", { scope: "EU" })).toBe("pass");
    expect(checkGeography("DE", { scope: "EU" })).toBe("pass");
  });
  it("national scope: country must match", () => {
    expect(checkGeography("AT", { scope: "national", countries: ["AT"] })).toBe("pass");
    expect(checkGeography("DE", { scope: "national", countries: ["AT"] })).toBe("fail");
  });
  it("regional scope: country must match (NUTS check deferred)", () => {
    expect(
      checkGeography("AT", { scope: "regional", countries: ["AT"], regions: ["AT13"] })
    ).toBe("pass");
  });
  it("unknown country", () => {
    expect(checkGeography(null, { scope: "EU" })).toBe("unknown");
  });
});

describe("checkSector", () => {
  it("program with no sector restriction passes", () => {
    expect(checkSector(["62.01"], [])).toBe("pass");
  });
  it("matching sector passes", () => {
    expect(checkSector(["62.01"], ["62.01", "62.02"])).toBe("pass");
  });
  it("disjoint sectors fail", () => {
    expect(checkSector(["10.11"], ["62.01"])).toBe("fail");
  });
  it("org has no sectors", () => {
    expect(checkSector([], ["62.01"])).toBe("unknown");
  });
});

describe("checkSme", () => {
  it("not required → pass for anyone", () => {
    expect(checkSme("large", false)).toBe("pass");
    expect(checkSme("micro", false)).toBe("pass");
  });
  it("required + sme = pass", () => {
    expect(checkSme("micro", true)).toBe("pass");
    expect(checkSme("medium", true)).toBe("pass");
  });
  it("required + large = fail", () => {
    expect(checkSme("large", true)).toBe("fail");
  });
  it("required + unknown = unknown", () => {
    expect(checkSme("unknown", true)).toBe("unknown");
  });
  it("not specified → not required", () => {
    expect(checkSme("large", undefined)).toBe("pass");
  });
});

describe("checkTrl", () => {
  it("no range = pass", () => {
    expect(checkTrl(5, undefined)).toBe("pass");
  });
  it("inside range = pass", () => {
    expect(checkTrl(5, [5, 9])).toBe("pass");
    expect(checkTrl(7, [5, 9])).toBe("pass");
  });
  it("one off = warn", () => {
    expect(checkTrl(4, [5, 9])).toBe("warn"); // one below
    expect(checkTrl(10 as never, [5, 9])).toBe("fail"); // hard above (TRL >9 invalid anyway)
  });
  it("more than one off = fail", () => {
    expect(checkTrl(2, [5, 9])).toBe("fail");
  });
  it("null TRL = unknown", () => {
    expect(checkTrl(null, [5, 9])).toBe("unknown");
  });
});

describe("checkAmount", () => {
  it("no caps = pass", () => {
    expect(checkAmount("100000.00", null, null)).toBe("pass");
  });
  it("inside band = pass", () => {
    expect(checkAmount("500000.00", "100000.00", "1000000.00")).toBe("pass");
  });
  it("at min = pass", () => {
    expect(checkAmount("100000.00", "100000.00", "1000000.00")).toBe("pass");
  });
  it("just below min = warn", () => {
    // ≥80% of min counts as warn
    expect(checkAmount("85000.00", "100000.00", "1000000.00")).toBe("warn");
  });
  it("far below min = fail", () => {
    expect(checkAmount("10000.00", "100000.00", "1000000.00")).toBe("fail");
  });
  it("above max = fail", () => {
    expect(checkAmount("2000000.00", "100000.00", "1000000.00")).toBe("fail");
  });
  it("null gap = unknown", () => {
    expect(checkAmount(null, "100000.00", "1000000.00")).toBe("unknown");
  });
});

describe("checkDeadline", () => {
  it("rolling (null deadline) = pass", () => {
    expect(checkDeadline(new Date("2026-06-01"), null)).toBe("pass");
  });
  it("project starts before deadline = pass", () => {
    expect(checkDeadline(new Date("2026-06-01"), new Date("2026-09-01"))).toBe("pass");
  });
  it("project starts after deadline = fail", () => {
    expect(checkDeadline(new Date("2026-09-01"), new Date("2026-06-01"))).toBe("fail");
  });
  it("null timeline_start = unknown", () => {
    expect(checkDeadline(null, new Date("2026-06-01"))).toBe("unknown");
  });
});

describe("checkLegalForm", () => {
  it("no restriction = pass", () => {
    expect(checkLegalForm("GmbH", undefined)).toBe("pass");
  });
  it("matches = pass", () => {
    expect(checkLegalForm("GmbH", ["GmbH", "AG"])).toBe("pass");
  });
  it("does not match = fail", () => {
    expect(checkLegalForm("Sole trader", ["GmbH", "AG"])).toBe("fail");
  });
  it("null org legal form = unknown", () => {
    expect(checkLegalForm(null, ["GmbH"])).toBe("unknown");
  });
});

describe("checkEquity", () => {
  it("non-equity programs always pass regardless of willingness", () => {
    expect(checkEquity("none", "grant")).toBe("pass");
    expect(checkEquity(null, "debt")).toBe("pass");
  });
  it("equity program + willingness = pass", () => {
    expect(checkEquity("minority", "equity")).toBe("pass");
    expect(checkEquity("majority", "equity")).toBe("pass");
  });
  it("equity program + 'none' = fail", () => {
    expect(checkEquity("none", "equity")).toBe("fail");
  });
  it("equity program + null = unknown", () => {
    expect(checkEquity(null, "equity")).toBe("unknown");
  });
});

describe("evaluate", () => {
  const baseOrg = {
    country: "AT",
    sectors: ["62.01"],
    sme_classification: "small",
    legal_form: "GmbH",
  } as const;
  const baseProject = {
    trl: 6,
    funding_gap: "500000.00",
    timeline_start: new Date("2026-06-01"),
    equity_willingness: "minority",
  } as const;
  const baseProgram = {
    id: "00000000-0000-0000-0000-000000000001",
    kind: "grant",
    geography_scope: { scope: "national", countries: ["AT"] },
    sectors: ["62.01"],
    min_amount: "100000.00",
    max_amount: "1000000.00",
    application_deadline: null,
    eligibility_rules: { trl_range: [5, 9] as [number, number], sme_required: true } satisfies EligibilityRules,
  };

  it("happy path → all pass, hard_fail false", () => {
    const r = evaluate(baseOrg, baseProject, baseProgram);
    expect(r.hard_fail).toBe(false);
    expect(r.flags.geography).toBe("pass");
    expect(r.flags.trl).toBe("pass");
  });

  it("any fail flips hard_fail", () => {
    const r = evaluate(
      baseOrg,
      baseProject,
      { ...baseProgram, geography_scope: { scope: "national", countries: ["DE"] } as GeographyScope }
    );
    expect(r.flags.geography).toBe("fail");
    expect(r.hard_fail).toBe(true);
  });

  it("warn does not flip hard_fail", () => {
    const r = evaluate(baseOrg, { ...baseProject, trl: 4 }, baseProgram);
    expect(r.flags.trl).toBe("warn");
    expect(r.hard_fail).toBe(false);
  });

  it("score: pass=1, warn=0.5, fail/unknown=0; aggregated", () => {
    const r = evaluate(baseOrg, baseProject, baseProgram);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
bun run test src/matchmaker/eligibility.test.ts
```

- [ ] **Step 3: Implement `src/matchmaker/eligibility.ts`**

```ts
import type { GeographyScope, EligibilityRules } from "@/domain/programs";

export type FlagState = "pass" | "warn" | "fail" | "unknown";

export type EligibilityFlags = {
  geography: FlagState;
  sector: FlagState;
  sme: FlagState;
  trl: FlagState;
  amount: FlagState;
  deadline: FlagState;
  legal_form: FlagState;
  equity: FlagState;
};

export type EligibilityResult = {
  program_id: string;
  flags: EligibilityFlags;
  hard_fail: boolean;
  score: number; // 0–100
};

type SmeClass = "micro" | "small" | "medium" | "large" | "unknown";
type ProgramKind = "grant" | "equity" | "debt" | "alternative";
type EquityWillingness = "none" | "minority" | "majority" | null;

export function checkGeography(
  orgCountry: string | null,
  scope: GeographyScope
): FlagState {
  if (orgCountry == null) return "unknown";
  if (scope.scope === "EU") {
    if (!scope.countries || scope.countries.length === 0) return "pass";
    return scope.countries.includes(orgCountry) ? "pass" : "fail";
  }
  return scope.countries.includes(orgCountry) ? "pass" : "fail";
}

export function checkSector(orgSectors: string[], programSectors: string[]): FlagState {
  if (programSectors.length === 0) return "pass";
  if (orgSectors.length === 0) return "unknown";
  return orgSectors.some((s) => programSectors.includes(s)) ? "pass" : "fail";
}

export function checkSme(smeClass: SmeClass, smeRequired: boolean | undefined): FlagState {
  if (!smeRequired) return "pass";
  if (smeClass === "unknown") return "unknown";
  return smeClass === "large" ? "fail" : "pass";
}

export function checkTrl(
  trl: number | null,
  range: readonly [number, number] | undefined
): FlagState {
  if (!range) return "pass";
  if (trl == null) return "unknown";
  const [min, max] = range;
  if (trl >= min && trl <= max) return "pass";
  if (trl === min - 1 || trl === max + 1) {
    // one TRL off the range counts as borderline
    return trl >= 1 && trl <= 9 ? "warn" : "fail";
  }
  return "fail";
}

export function checkAmount(
  fundingGap: string | null,
  minAmount: string | null,
  maxAmount: string | null
): FlagState {
  if (fundingGap == null) return "unknown";
  const gap = Number(fundingGap);
  const min = minAmount == null ? null : Number(minAmount);
  const max = maxAmount == null ? null : Number(maxAmount);
  if (max != null && gap > max) return "fail";
  if (min != null && gap < min) {
    // within 20% of the floor counts as warn (program might still consider you)
    return gap >= 0.8 * min ? "warn" : "fail";
  }
  return "pass";
}

export function checkDeadline(
  timelineStart: Date | null,
  deadline: Date | null
): FlagState {
  if (deadline == null) return "pass"; // rolling
  if (timelineStart == null) return "unknown";
  return timelineStart <= deadline ? "pass" : "fail";
}

export function checkLegalForm(
  orgLegalForm: string | null,
  allowed: string[] | undefined
): FlagState {
  if (!allowed || allowed.length === 0) return "pass";
  if (orgLegalForm == null) return "unknown";
  return allowed.includes(orgLegalForm) ? "pass" : "fail";
}

export function checkEquity(
  willingness: EquityWillingness,
  kind: ProgramKind
): FlagState {
  if (kind !== "equity") return "pass";
  if (willingness == null) return "unknown";
  return willingness === "none" ? "fail" : "pass";
}

const FLAG_WEIGHT: Record<FlagState, number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  unknown: 0,
};

export function evaluate(
  org: {
    country: string | null;
    sectors: string[];
    sme_classification: SmeClass;
    legal_form: string | null;
  },
  project: {
    trl: number | null;
    funding_gap: string | null;
    timeline_start: Date | null;
    equity_willingness: EquityWillingness;
  },
  program: {
    id: string;
    kind: ProgramKind;
    geography_scope: GeographyScope;
    sectors: string[];
    min_amount: string | null;
    max_amount: string | null;
    application_deadline: Date | null;
    eligibility_rules: EligibilityRules;
  }
): EligibilityResult {
  const flags: EligibilityFlags = {
    geography: checkGeography(org.country, program.geography_scope),
    sector: checkSector(org.sectors, program.sectors),
    sme: checkSme(org.sme_classification, program.eligibility_rules.sme_required),
    trl: checkTrl(project.trl, program.eligibility_rules.trl_range),
    amount: checkAmount(project.funding_gap, program.min_amount, program.max_amount),
    deadline: checkDeadline(project.timeline_start, program.application_deadline),
    legal_form: checkLegalForm(org.legal_form, program.eligibility_rules.legal_forms),
    equity: checkEquity(project.equity_willingness, program.kind),
  };
  const hard_fail = Object.values(flags).some((f) => f === "fail");
  const total = Object.values(flags).reduce((acc, f) => acc + FLAG_WEIGHT[f], 0);
  const score = Math.round((total / Object.keys(flags).length) * 100);
  return { program_id: program.id, flags, hard_fail, score };
}
```

- [ ] **Step 4: Run — expect 30+ tests passing**

```bash
bun run test src/matchmaker/eligibility.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(matchmaker): add pure eligibility filter with table-driven tests"
```

---

## Task 5: Server actions for funding programs

**Files:**
- Create: `src/server/programs.ts`, `src/server/programs.integration.test.ts`

Read-only actions for now (`listPrograms`, `getProgram`). No create/update/delete from UI in Plan B — programs come from seed and (in Plan C) LLM research.

- [ ] **Step 1: Write the failing tests**

Create `src/server/programs.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { closeDb, testDb } from "../../tests/db";
import { listPrograms, getProgram } from "./programs";
import { funding_programs } from "@/db/schema";
import { sql } from "drizzle-orm";
import { seedPrograms } from "@/db/seeds/programs";

beforeAll(async () => {
  // Don't truncate orgs/projects — only programs. Re-seed.
  await testDb.execute(sql`TRUNCATE TABLE funding_programs RESTART IDENTITY CASCADE`);
  for (const p of seedPrograms) {
    await testDb.insert(funding_programs).values({
      ...p,
      application_deadline: undefined,
      last_verified_at: new Date(),
    });
  }
});
afterAll(async () => {
  await closeDb();
});

describe("listPrograms", () => {
  it("returns all when no filter", async () => {
    const rows = await listPrograms();
    expect(rows.length).toBe(seedPrograms.length);
  });

  it("filters by kind", async () => {
    const rows = await listPrograms({ kind: "equity" });
    expect(rows.every((r) => r.kind === "equity")).toBe(true);
    expect(rows.length).toBe(seedPrograms.filter((p) => p.kind === "equity").length);
  });

  it("filters by country (matches EU + national matching)", async () => {
    const rows = await listPrograms({ country: "AT" });
    // Should include EU-wide + Austria-national. Not Germany-national.
    expect(rows.every((r) => {
      const scope = r.geography_scope as { scope: string; countries?: string[] };
      return scope.scope === "EU" || (scope.countries ?? []).includes("AT");
    })).toBe(true);
  });
});

describe("getProgram", () => {
  it("returns null for unknown id", async () => {
    const r = await getProgram("00000000-0000-0000-0000-000000000999");
    expect(r).toBeNull();
  });

  it("returns the row by id", async () => {
    const all = await listPrograms();
    const r = await getProgram(all[0].id);
    expect(r?.id).toBe(all[0].id);
  });
});
```

- [ ] **Step 2: Run — expect module-not-found failure**

- [ ] **Step 3: Implement `src/server/programs.ts`**

```ts
"use server";

import { eq, asc, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { funding_programs } from "@/db/schema";

type Filter = {
  kind?: "grant" | "equity" | "debt" | "alternative";
  country?: string;
};

export async function listPrograms(filter?: Filter) {
  const conds: SQL[] = [];
  if (filter?.kind) conds.push(eq(funding_programs.kind, filter.kind));
  if (filter?.country) {
    // Match EU-wide OR programs whose geography_scope.countries contains the country.
    conds.push(sql`(
      ${funding_programs.geography_scope}->>'scope' = 'EU'
      OR ${funding_programs.geography_scope}->'countries' @> to_jsonb(${filter.country}::text)
    )`);
  }
  const where =
    conds.length === 0
      ? undefined
      : conds.length === 1
        ? conds[0]
        : sql.join(conds, sql` AND `);
  return db
    .select()
    .from(funding_programs)
    .where(where)
    .orderBy(asc(funding_programs.provider), asc(funding_programs.program_name));
}

export async function getProgram(id: string) {
  const rows = await db
    .select()
    .from(funding_programs)
    .where(eq(funding_programs.id, id))
    .limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Run — expect 5 tests passing**

```bash
bun run test:integration src/server/programs.integration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add read-only program actions with kind/country filter"
```

---

## Task 6: `/catalog` page with filters

**Files:**
- Create: `src/app/catalog/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import Link from "next/link";
import { listPrograms } from "@/server/programs";

const KINDS = ["grant", "equity", "debt", "alternative"] as const;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; country?: string }>;
}) {
  const sp = await searchParams;
  const kind = (KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as typeof KINDS[number]) : undefined;
  const country = sp.country?.length === 2 ? sp.country.toUpperCase() : undefined;
  const rows = await listPrograms({ kind, country });

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Funding catalog</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground">Kind:</span>
        <FilterLink href={`?${qs({ ...sp, kind: undefined })}`} active={!kind}>All</FilterLink>
        {KINDS.map((k) => (
          <FilterLink key={k} href={`?${qs({ ...sp, kind: k })}`} active={kind === k}>
            {k}
          </FilterLink>
        ))}
        <span className="ml-4 text-muted-foreground">Country:</span>
        {["AT", "DE", "EU"].map((c) => (
          <FilterLink
            key={c}
            href={`?${qs({ ...sp, country: c === "EU" ? undefined : c })}`}
            active={c === "EU" ? !country : country === c}
          >
            {c}
          </FilterLink>
        ))}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Program</th>
            <th>Kind</th>
            <th>Provider</th>
            <th>Geography</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const scope = p.geography_scope as { scope: string; countries?: string[] };
            return (
              <tr key={p.id} className="border-b hover:bg-muted/40">
                <td className="py-2">
                  <Link href={`/catalog/${p.id}`} className="hover:underline">
                    {p.program_name}
                  </Link>
                </td>
                <td>{p.kind}</td>
                <td>{p.provider}</td>
                <td>{scope.scope === "EU" ? "EU" : (scope.countries ?? []).join(", ")}</td>
                <td>
                  {p.min_amount && p.max_amount
                    ? `€${formatM(p.min_amount)}–${formatM(p.max_amount)}`
                    : "—"}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="py-4 text-muted-foreground" colSpan={5}>
                No programs match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-2 py-0.5 rounded border ${active ? "bg-foreground text-background" : "hover:bg-muted"}`}
    >
      {children}
    </Link>
  );
}

function formatM(amount: string): string {
  const n = Number(amount);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

function qs(obj: Record<string, string | undefined>): string {
  return new URLSearchParams(
    Object.entries(obj).filter(([, v]) => v != null) as [string, string][]
  ).toString();
}
```

- [ ] **Step 2: Add nav entry**

In `src/components/layout/Nav.tsx`, append `{ href: "/catalog", label: "Catalog" }` to the `links` array.

- [ ] **Step 3: Verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add /catalog browse with kind and country filters"
```

---

## Task 7: `/catalog/[id]` program detail

**Files:**
- Create: `src/app/catalog/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import { getProgram } from "@/server/programs";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProgram(id);
  if (!p) notFound();

  const scope = p.geography_scope as { scope: string; countries?: string[]; regions?: string[] };
  const rules = p.eligibility_rules as Record<string, unknown>;

  return (
    <article className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground uppercase tracking-wide">{p.kind}</p>
        <h1 className="text-2xl font-semibold">{p.program_name}</h1>
        <p className="text-muted-foreground">{p.provider}</p>
        {p.url && (
          <p className="text-sm">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline">
              Official page ↗
            </a>
          </p>
        )}
      </header>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Item label="Geography">
          {scope.scope === "EU" ? "EU-wide" : `${scope.scope} — ${(scope.countries ?? []).join(", ")}`}
          {scope.regions && scope.regions.length > 0 ? ` (${scope.regions.join(", ")})` : ""}
        </Item>
        <Item label="Amount range">
          {p.min_amount && p.max_amount
            ? `€${Number(p.min_amount).toLocaleString()} – €${Number(p.max_amount).toLocaleString()}`
            : "—"}
        </Item>
        <Item label="Deadline">
          {p.application_deadline ? p.application_deadline : "Rolling"}
        </Item>
        <Item label="Confidence">{p.confidence}</Item>
      </dl>

      <section>
        <h2 className="text-lg font-semibold mb-2">Eligibility rules</h2>
        <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{JSON.stringify(rules, null, 2)}
        </pre>
      </section>

      {p.domains.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Domains</h2>
          <ul className="flex flex-wrap gap-2">
            {p.domains.map((d) => (
              <li key={d} className="px-2 py-0.5 border rounded text-sm">{d}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): add /catalog/[id] program detail page"
```

---

## Task 8: Quick-match panel on project detail

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`
- Create: `src/server/match.ts` (thin wrapper around the matchmaker that loads catalog + adapts types)

The panel runs the eligibility filter against the seed catalog for the current project and displays the top 10 ranked by score.

- [ ] **Step 1: Create the wrapper**

`src/server/match.ts`:

```ts
"use server";

import { db } from "@/db/client";
import { funding_programs } from "@/db/schema";
import { evaluate, type EligibilityResult } from "@/matchmaker/eligibility";
import type { Organization, Project } from "@/db/schema";
import type { GeographyScope, EligibilityRules } from "@/domain/programs";

type ProgramRow = typeof funding_programs.$inferSelect;

export async function quickMatch(
  org: Organization,
  project: Project
): Promise<Array<EligibilityResult & { program: ProgramRow }>> {
  const programs = await db.select().from(funding_programs);
  const results: Array<EligibilityResult & { program: ProgramRow }> = [];
  for (const program of programs) {
    const r = evaluate(
      {
        country: org.country,
        sectors: org.sectors,
        sme_classification: org.sme_classification,
        legal_form: org.legal_form,
      },
      {
        trl: project.trl,
        funding_gap: project.funding_gap,
        timeline_start: project.timeline_start ? new Date(project.timeline_start) : null,
        equity_willingness: project.equity_willingness,
      },
      {
        id: program.id,
        kind: program.kind,
        geography_scope: program.geography_scope as GeographyScope,
        sectors: program.sectors,
        min_amount: program.min_amount,
        max_amount: program.max_amount,
        application_deadline: program.application_deadline ? new Date(program.application_deadline) : null,
        eligibility_rules: program.eligibility_rules as EligibilityRules,
      }
    );
    results.push({ ...r, program });
  }
  // Eliminate hard fails; sort by score desc.
  return results.filter((r) => !r.hard_fail).sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 2: Add the panel to project detail page**

Modify `src/app/projects/[id]/page.tsx` — at the top, import `getOrg` (already imported) and add:

```ts
import { quickMatch } from "@/server/match";
```

After the existing data loads (`const project = await getProject(id);` etc), add:

```ts
const matches = parent ? await quickMatch(parent, project) : [];
```

Then inside the JSX, after the `<ProjectForm>` block but before the closing `</section>`, add:

```tsx
<section>
  <h2 className="text-xl font-semibold mb-2">Quick match — top 10 (deterministic)</h2>
  {matches.length === 0 ? (
    <p className="text-sm text-muted-foreground">
      No eligible programs in the catalog. Fill in country, TRL, funding gap, and (for equity) equity willingness on this project to expand the search.
    </p>
  ) : (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Program</th>
          <th>Kind</th>
          <th>Score</th>
          <th>Flags</th>
        </tr>
      </thead>
      <tbody>
        {matches.slice(0, 10).map((m) => (
          <tr key={m.program_id} className="border-b">
            <td className="py-2">
              <Link href={`/catalog/${m.program_id}`} className="hover:underline">
                {m.program.program_name}
              </Link>
              <span className="text-xs text-muted-foreground"> — {m.program.provider}</span>
            </td>
            <td>{m.program.kind}</td>
            <td>{m.score}</td>
            <td className="text-xs">
              {Object.entries(m.flags)
                .filter(([, v]) => v !== "pass")
                .map(([k, v]) => `${k}:${v}`)
                .join(" · ") || "all pass"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
```

- [ ] **Step 3: Verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add quick-match panel to project detail page"
```

---

## Task 9: E2E smoke update

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`, `tests/e2e/global-setup.ts`

Extend the smoke flow to also visit `/catalog` (assert 15 rows) and confirm the project detail page shows the quick-match panel.

- [ ] **Step 1: Update global-setup to seed programs**

`tests/e2e/global-setup.ts`:

```ts
import { resetDb, closeDb, testDb } from "../db";
import { funding_programs } from "@/db/schema";
import { sql } from "drizzle-orm";
import { seedPrograms } from "@/db/seeds/programs";

export default async function globalSetup() {
  await resetDb();
  await testDb.execute(sql`TRUNCATE TABLE funding_programs RESTART IDENTITY CASCADE`);
  for (const p of seedPrograms) {
    await testDb.insert(funding_programs).values({
      ...p,
      application_deadline: undefined,
      last_verified_at: new Date(),
    });
  }
  await closeDb();
}
```

- [ ] **Step 2: Extend `tests/e2e/smoke.spec.ts`** — append after the existing project verification:

```ts
  // Catalog browse
  await page.getByRole("link", { name: "Catalog" }).click();
  await expect(page.getByRole("heading", { name: "Funding catalog" })).toBeVisible();
  // Should list multiple seeded programs (15 total in seed)
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(15);

  // Filter by kind=equity
  await page.getByRole("link", { name: "equity", exact: true }).click();
  await expect(page.locator("table tbody tr")).toHaveCount(3);

  // Quick match: navigate to project detail and assert the panel renders
  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("link", { name: PROJECT }).click();
  await expect(page.getByRole("heading", { name: /Quick match/i })).toBeVisible();
```

- [ ] **Step 3: Run**

```bash
bun run e2e
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(e2e): extend smoke to cover catalog browse and quick-match panel"
```

---

## Task 10: Apply seed catalog to Neon prod, PR, deploy

**Files:** None — git/CI/deploy only.

- [ ] **Step 1: Apply migration `0001` to Neon prod**

```bash
DATABASE_URL="<your-neon-prod-url>" bun run db:migrate
```

Expected: migrations applied successfully.

- [ ] **Step 2: Seed Neon prod**

```bash
DATABASE_URL="<your-neon-prod-url>" bun run db:seed
```

Expected: `Seed complete: 15 inserted, 0 updated`.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/catalog-eligibility
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --base main --head feat/catalog-eligibility \
  --title "Plan B: Catalog & eligibility filter" \
  --body "Adds funding_programs catalog (15 EU programs seeded), pure eligibility filter with table-driven tests, /catalog browse, and a Quick-match panel on project detail."
```

- [ ] **Step 5: Squash-merge**

```bash
gh pr merge --squash --delete-branch
```

Vercel auto-deploys main → prod.

- [ ] **Step 6: Smoke prod**

```bash
curl -sI https://funding-advisor-stefan-papps-projects.vercel.app/catalog
```

Expected: HTTP 401 (still password-protected). Open in browser, verify catalog loads and shows 15 programs.

- [ ] **Step 7: Tag**

```bash
git checkout main && git pull --ff-only
git tag -a v0.2.0 -m "Plan B: catalog + eligibility filter"
git push origin v0.2.0
```

---

## Verification checklist

- [ ] `bun run test` — all green (existing 23 + new ~35 from T2 + T4)
- [ ] `bun run test:integration` — all green (existing 13 + new 5 from T5)
- [ ] `bun run e2e` — extended smoke green
- [ ] `bun run build` — clean
- [ ] Manual: `/catalog` lists 15 programs, kind filter narrows correctly
- [ ] Manual: project detail page shows Quick-match panel with top matches
- [ ] Manual: no LLM calls anywhere — this plan is deterministic-only

## Spec coverage check

- ✓ `funding_programs` table — Task 1
- ✓ Seed catalog — Task 3
- ✓ Eligibility filter (pure, all 8 checks) — Task 4
- ✓ `/catalog` browse — Task 6
- ✓ `/catalog/[id]` detail — Task 7
- ✓ Project quick-match (preview of full Plan C output) — Task 8
- ⏸ LLM research — Plan C
- ⏸ Strategy narrative + streaming — Plan C
- ⏸ `strategy_reports` and `eligibility_results` tables — Plan C
- ⏸ Consortium-partners array editor — still deferred (Plan B only sets a default of `[]`)
