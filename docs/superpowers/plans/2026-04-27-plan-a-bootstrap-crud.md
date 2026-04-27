# Plan A — Bootstrap & Master-Data CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable Next.js 16 app on Vercel with Postgres + full CRUD for `organizations` and `projects`. End state: an internal CRUD tool the user can already use.

**Architecture:** Next.js 16 App Router, Server Components by default, Drizzle ORM over Postgres (Neon in prod, Docker locally), `react-hook-form` + Zod for forms (Zod schemas reused server-side via Server Actions), Tailwind + shadcn/ui, Vitest for unit/integration, Playwright for E2E smoke.

**Tech Stack:** Bun, Next.js 16, TypeScript 5, Drizzle ORM, `postgres-js` driver, Tailwind v4, shadcn/ui, `react-hook-form`, Zod, Vitest, Playwright, Docker Compose (local Postgres), Vercel + Neon (production).

**Spec reference:** `docs/superpowers/specs/2026-04-27-funding-advisor-design.md` — sections "Data model → organizations / projects", "UI structure", "Forms", "Testing".

**Important — APIs change.** Next.js 16, Drizzle, Vitest, Playwright, and Tailwind v4 have all moved since most training data. **If a command in this plan fails, consult current docs before "fixing" it locally.** Doc links inline per task.

**Branch strategy.** Repo currently has only `docs/initial-spec`, no `main`. Task 0 establishes `main` and a feat branch.

---

## Task 0: Establish `main` and feature branch

**Files:** none (git only)

- [ ] **Step 1: Verify current branch state**

```bash
git status && git log --oneline -5 && git branch --all
```

Expected: clean tree on `docs/initial-spec`, two commits (initial spec + clarify wording), no `main`.

- [ ] **Step 2: Create `main` from current commit, switch to feat branch**

```bash
git branch main
git checkout -b feat/bootstrap-crud
git branch --all
```

Expected output (last command):
```
  docs/initial-spec
  main
* feat/bootstrap-crud
```

- [ ] **Step 3: No commit yet — branch only**

`main` and `feat/bootstrap-crud` both point at the spec commit. Subsequent tasks commit to `feat/bootstrap-crud`.

---

## Task 1: Initialize Next.js 16 app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `bun.lock`
- Modify: `.gitignore` (add Next.js entries already present, verify)

**Docs:** https://nextjs.org/docs/app/getting-started/installation

- [ ] **Step 1: Run create-next-app**

In `/Users/stefanpapp/src/funding-advisor` (root):

```bash
bunx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-bun \
  --eslint
```

The directory is non-empty (has `.git`, `.gitignore`, `docs/`, `.claude/`). `create-next-app` will warn and may prompt to confirm — accept. It will overwrite `.gitignore` with its template; we re-add our line in step 3.

- [ ] **Step 2: Verify dev server boots**

```bash
bun run dev
```

Expected: server boots on `http://localhost:3000`, terminal shows "Ready in Xms". Open the URL — Next.js welcome page loads. Stop with Ctrl-C.

- [ ] **Step 3: Restore the `.claude/settings.local.json` ignore**

`create-next-app` overwrote `.gitignore`. Re-append our project-specific line:

```bash
echo "" >> .gitignore
echo "# claude code local settings" >> .gitignore
echo ".claude/settings.local.json" >> .gitignore
```

Verify with `git status` that `.claude/settings.local.json` is NOT showing as untracked.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(bootstrap): initialize Next.js 16 app with TypeScript, Tailwind, App Router"
```

---

## Task 2: Initialize shadcn/ui and add base components

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/*.tsx` (one per component installed)

**Docs:** https://ui.shadcn.com/docs/installation/next

- [ ] **Step 1: Init shadcn**

```bash
bunx shadcn@latest init -d
```

Pick "Default" style and "Slate" base color when prompted (or accept defaults via `-d`).

- [ ] **Step 2: Add components used in this plan**

```bash
bunx shadcn@latest add button input label form table textarea select badge dialog separator card
```

- [ ] **Step 3: Sanity-check the imports**

```bash
bun run build
```

Expected: build succeeds. If shadcn versions mismatch with React 19 / Next 16, consult https://ui.shadcn.com/docs/react-19 — use the override flag if prompted.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(bootstrap): install shadcn/ui with base components"
```

---

## Task 3: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `src/lib/sanity.test.ts`
- Modify: `package.json` (add `test` script)

**Docs:** https://vitest.dev/guide/

- [ ] **Step 1: Install Vitest + RTL**

```bash
bun add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom happy-dom @vitejs/plugin-react
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/**/*.integration.test.ts", "node_modules", ".next"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `"scripts"` block:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a sanity test**

Create `src/lib/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

```bash
bun run test
```

Expected: 1 passed. If Vitest can't resolve the `@` alias in later tasks, double-check `vitest.config.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test(bootstrap): configure vitest with jsdom and RTL"
```

---

## Task 4: Configure Playwright (smoke only)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `package.json` (add `e2e` script), `.gitignore` (add `playwright-report/`, `test-results/`)

**Docs:** https://playwright.dev/docs/intro

- [ ] **Step 1: Install Playwright**

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 3: Add ignore + script entries**

Append to `.gitignore`:

```
playwright-report/
test-results/
playwright/.cache/
```

In `package.json` scripts:

```json
"e2e": "playwright test"
```

- [ ] **Step 4: Write a smoke E2E test**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/funding/i);
});
```

This will fail until the layout title is set. We'll fix the title in Task 13.

- [ ] **Step 5: Run it (expect failure)**

```bash
bun run e2e
```

Expected: FAIL on title regex (the default Next.js title is "Create Next App"). This is intentional — Task 13 sets the title and the test goes green. Leave it as a failing checkpoint.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(bootstrap): configure playwright with failing smoke test (title set in task 13)"
```

---

## Task 5: Local Postgres via Docker Compose

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env.local`
- Modify: `.gitignore` (verify `.env.local` is ignored — already is)

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: funding-advisor-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: funding_advisor
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d funding_advisor"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s

volumes:
  pgdata:
```

- [ ] **Step 2: Write `.env.example`**

```
# Postgres connection used by Drizzle and the app at runtime.
DATABASE_URL=postgres://dev:dev@localhost:5432/funding_advisor
```

- [ ] **Step 3: Write `.env.local`** (NOT committed — `.gitignore` covers it)

Identical content to `.env.example` for local dev.

- [ ] **Step 4: Bring up the DB**

```bash
docker compose up -d
docker compose ps
```

Expected: `db` is `healthy` after ~10 seconds. If it doesn't go healthy, run `docker compose logs db`.

- [ ] **Step 5: Verify connection**

```bash
docker compose exec db psql -U dev -d funding_advisor -c '\dt'
```

Expected: `Did not find any relations.` (empty DB; tables come in Task 9).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(db): add docker-compose postgres for local dev"
```

---

## Task 6: Drizzle setup (client + config + empty schema)

**Files:**
- Create: `drizzle.config.ts`, `src/db/client.ts`, `src/db/schema.ts`, `src/db/migrations/.gitkeep`
- Modify: `package.json` (add scripts)

**Docs:** https://orm.drizzle.team/docs/get-started/postgresql-new

- [ ] **Step 1: Install Drizzle**

```bash
bun add drizzle-orm postgres
bun add -D drizzle-kit
```

(We use the `postgres-js` driver, not `node-postgres`, so no `@types/pg`.)

- [ ] **Step 2: Write `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 3: Write `src/db/client.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const queryClient = postgres(connectionString, { max: 10 });
export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
```

- [ ] **Step 4: Empty `src/db/schema.ts`**

```ts
// Tables added in Task 9.
export {};
```

- [ ] **Step 5: Create `.gitkeep` for migrations dir**

```bash
mkdir -p src/db/migrations
touch src/db/migrations/.gitkeep
```

- [ ] **Step 6: Add Drizzle scripts to `package.json`**

```json
"db:generate": "drizzle-kit generate",
"db:push":     "drizzle-kit push",
"db:migrate":  "drizzle-kit migrate",
"db:studio":   "drizzle-kit studio"
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): add drizzle client, config, and empty schema"
```

---

## Task 7: SME classification function (TDD, pure)

**Files:**
- Create: `src/domain/sme.ts`, `src/domain/sme.test.ts`

The EU SME definition (Recommendation 2003/361/EC):
- **Micro:** < 10 employees AND (annual revenue ≤ €2M OR balance sheet total ≤ €2M)
- **Small:** < 50 employees AND (annual revenue ≤ €10M OR balance sheet total ≤ €10M)
- **Medium:** < 250 employees AND (annual revenue ≤ €50M OR balance sheet total ≤ €43M)
- **Large:** anything bigger
- **Unknown:** any of the three inputs is null/undefined

Note the OR for revenue/balance — only ONE of the two financial ceilings must be met (along with the headcount).

- [ ] **Step 1: Write the failing tests**

Create `src/domain/sme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classifySme } from "./sme";

describe("classifySme", () => {
  it("returns 'unknown' when employee_count is null", () => {
    expect(classifySme({ employees: null, revenue: 1000, balance: 1000 })).toBe("unknown");
  });

  it("returns 'unknown' when both financials are null", () => {
    expect(classifySme({ employees: 5, revenue: null, balance: null })).toBe("unknown");
  });

  it("returns 'micro' for 5 employees and €1M revenue", () => {
    expect(classifySme({ employees: 5, revenue: 1_000_000, balance: 5_000_000 })).toBe("micro");
  });

  it("returns 'small' when employees=20, revenue=€8M, balance=€20M (revenue gate)", () => {
    expect(classifySme({ employees: 20, revenue: 8_000_000, balance: 20_000_000 })).toBe("small");
  });

  it("returns 'small' when employees=20, revenue=€20M, balance=€8M (balance gate)", () => {
    expect(classifySme({ employees: 20, revenue: 20_000_000, balance: 8_000_000 })).toBe("small");
  });

  it("returns 'medium' for 200 employees, €40M revenue, €40M balance", () => {
    expect(classifySme({ employees: 200, revenue: 40_000_000, balance: 40_000_000 })).toBe("medium");
  });

  it("returns 'large' for 300 employees", () => {
    expect(classifySme({ employees: 300, revenue: 1_000_000, balance: 1_000_000 })).toBe("large");
  });

  it("returns 'large' when financials exceed every ceiling", () => {
    expect(classifySme({ employees: 100, revenue: 100_000_000, balance: 100_000_000 })).toBe("large");
  });

  it("micro boundary: 9 employees + €2M revenue is micro", () => {
    expect(classifySme({ employees: 9, revenue: 2_000_000, balance: 50_000_000 })).toBe("micro");
  });

  it("micro→small: 10 employees crosses to small", () => {
    expect(classifySme({ employees: 10, revenue: 1_000_000, balance: 1_000_000 })).toBe("small");
  });

  it("small→medium: 50 employees crosses to medium", () => {
    expect(classifySme({ employees: 50, revenue: 1_000_000, balance: 1_000_000 })).toBe("medium");
  });
});
```

- [ ] **Step 2: Run — expect failure (module not found)**

```bash
bun run test src/domain/sme.test.ts
```

Expected: FAIL — module `./sme` not found.

- [ ] **Step 3: Implement `src/domain/sme.ts`**

```ts
export type SmeClass = "micro" | "small" | "medium" | "large" | "unknown";

export type SmeInput = {
  employees: number | null;
  revenue: number | null;
  balance: number | null;
};

export function classifySme({ employees, revenue, balance }: SmeInput): SmeClass {
  if (employees == null) return "unknown";
  if (revenue == null && balance == null) return "unknown";

  // Pick the most favorable financial signal: SME definition uses OR between
  // annual revenue and balance sheet total — meeting EITHER one is sufficient.
  const meetsFinancial = (revenueCap: number, balanceCap: number) => {
    const revenueOk = revenue != null && revenue <= revenueCap;
    const balanceOk = balance != null && balance <= balanceCap;
    return revenueOk || balanceOk;
  };

  if (employees < 10 && meetsFinancial(2_000_000, 2_000_000)) return "micro";
  if (employees < 50 && meetsFinancial(10_000_000, 10_000_000)) return "small";
  if (employees < 250 && meetsFinancial(50_000_000, 43_000_000)) return "medium";
  return "large";
}
```

- [ ] **Step 4: Run — expect all green**

```bash
bun run test src/domain/sme.test.ts
```

Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): add SME classification function with table-driven tests"
```

---

## Task 8: Zod schemas for org and project (TDD)

**Files:**
- Create: `src/domain/schemas.ts`, `src/domain/schemas.test.ts`

Schemas mirror the spec's data model. Used by both forms (client) and Server Actions (server). Never import the Drizzle schema into a client component.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { orgInsertSchema, projectInsertSchema } from "./schemas";

describe("orgInsertSchema", () => {
  it("accepts a minimal valid org", () => {
    const r = orgInsertSchema.safeParse({
      legal_name: "Acme GmbH",
      country: "AT",
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing legal_name", () => {
    const r = orgInsertSchema.safeParse({ country: "AT" });
    expect(r.success).toBe(false);
  });

  it("rejects 3-letter country", () => {
    const r = orgInsertSchema.safeParse({ legal_name: "Acme", country: "AUT" });
    expect(r.success).toBe(false);
  });

  it("coerces empty string trading_name to undefined", () => {
    const r = orgInsertSchema.safeParse({ legal_name: "Acme", country: "AT", trading_name: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.trading_name).toBeUndefined();
  });

  it("accepts sectors array", () => {
    const r = orgInsertSchema.safeParse({
      legal_name: "Acme",
      country: "AT",
      sectors: ["62.01", "62.02"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative employee_count", () => {
    const r = orgInsertSchema.safeParse({
      legal_name: "Acme",
      country: "AT",
      employee_count: -1,
    });
    expect(r.success).toBe(false);
  });
});

describe("projectInsertSchema", () => {
  it("accepts a minimal valid project", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "Project Alpha",
    });
    expect(r.success).toBe(true);
  });

  it("rejects TRL out of range", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      trl: 0,
    });
    expect(r.success).toBe(false);

    const r2 = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      trl: 10,
    });
    expect(r2.success).toBe(false);
  });

  it("rejects bad UUID for organization_id", () => {
    const r = projectInsertSchema.safeParse({ organization_id: "not-a-uuid", title: "X" });
    expect(r.success).toBe(false);
  });

  it("accepts consortium_partners array", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      consortium_partners: [{ name: "Partner A", country: "DE", role: "research" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects funding_gap > total_budget when both set", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      total_budget: "100000.00",
      funding_gap: "200000.00",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
bun run test src/domain/schemas.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Install Zod**

```bash
bun add zod
```

- [ ] **Step 4: Implement `src/domain/schemas.ts`**

```ts
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal with up to 2 fractional digits")
  .optional();

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
    organization_id: z.string().uuid(),
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
    equity_willingness: equityWillingnessEnum.optional(),
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
```

- [ ] **Step 5: Run — expect green**

```bash
bun run test src/domain/schemas.test.ts
```

Expected: 10 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(domain): add Zod insert schemas for org and project"
```

---

## Task 9: Drizzle schema for organizations + projects, generate migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0000_*.sql` (generated)

**Docs:** https://orm.drizzle.team/docs/sql-schema-declaration

- [ ] **Step 1: Replace `src/db/schema.ts`**

```ts
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
```

- [ ] **Step 2: Generate migration**

```bash
bun run db:generate
```

Expected: a new SQL file appears in `src/db/migrations/0000_<adjective>_<noun>.sql`. Open it and review the SQL — confirm enums are created, both tables created, FK present.

- [ ] **Step 3: Apply to local DB**

```bash
bun run db:push
```

Expected: Drizzle reports tables created, no warnings.

- [ ] **Step 4: Verify in Postgres**

```bash
docker compose exec db psql -U dev -d funding_advisor -c '\d organizations' \
  && docker compose exec db psql -U dev -d funding_advisor -c '\d projects'
```

Expected: both tables exist with the columns above and FK on `projects.organization_id`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add organizations and projects tables with constraints"
```

---

## Task 10: Test fixtures — isolated DB per test run

**Files:**
- Create: `tests/db.ts`, `vitest.integration.config.ts`
- Modify: `package.json` (add `test:integration`)

For Server Action tests we need a real Postgres. We'll use the docker-compose DB and reset it between tests via TRUNCATE.

- [ ] **Step 1: Write the test helper**

Create `tests/db.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL ?? "postgres://dev:dev@localhost:5432/funding_advisor";
const queryClient = postgres(url, { max: 5 });
export const testDb = drizzle(queryClient, { schema });

export async function resetDb() {
  await testDb.execute(sql`TRUNCATE TABLE projects, organizations RESTART IDENTITY CASCADE`);
}

export async function closeDb() {
  await queryClient.end();
}
```

- [ ] **Step 2: Write `vitest.integration.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    globals: true,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Add script**

In `package.json`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 4: Smoke-run integration config (no tests yet)**

```bash
bun run test:integration
```

Expected: "No test files found" — that's fine. Confirms the config is valid.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(bootstrap): add integration test config and DB reset helper"
```

---

## Task 11: Server actions for organizations CRUD (TDD, integration)

**Files:**
- Create: `src/server/orgs.ts`, `src/server/orgs.integration.test.ts`

**Docs:** https://nextjs.org/docs/app/getting-started/updating-data#server-functions

Server Actions are the only write path. They:
1. Validate input via `orgInsertSchema`.
2. Derive `sme_classification` via `classifySme`.
3. Insert/update via Drizzle.
4. Call `revalidatePath` so RSC reads see the new state.

For tests we call the underlying functions directly (not as actions over HTTP) — that's the recommended pattern in Next 16.

- [ ] **Step 1: Write the failing tests**

Create `src/server/orgs.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { closeDb, resetDb, testDb } from "../../tests/db";
import { createOrg, updateOrg, deleteOrg, listOrgs, getOrg } from "./orgs";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await closeDb();
});

describe("createOrg", () => {
  it("inserts an org and derives sme_classification=micro", async () => {
    const id = await createOrg({
      legal_name: "Acme GmbH",
      country: "AT",
      employee_count: 5,
      annual_revenue: "1000000.00",
      balance_sheet_total: "1000000.00",
      sectors: [],
    });
    const row = await testDb.select().from(organizations).where(eq(organizations.id, id));
    expect(row[0].legal_name).toBe("Acme GmbH");
    expect(row[0].sme_classification).toBe("micro");
  });

  it("derives sme_classification=unknown when financials missing", async () => {
    const id = await createOrg({ legal_name: "Acme", country: "AT", sectors: [] });
    const row = await testDb.select().from(organizations).where(eq(organizations.id, id));
    expect(row[0].sme_classification).toBe("unknown");
  });

  it("rejects invalid input via Zod", async () => {
    await expect(
      createOrg({ legal_name: "", country: "AT", sectors: [] } as never)
    ).rejects.toThrow();
  });
});

describe("updateOrg / deleteOrg / list / get", () => {
  it("update changes fields and re-derives sme_classification", async () => {
    const id = await createOrg({ legal_name: "Acme", country: "AT", sectors: [] });
    await updateOrg(id, {
      legal_name: "Acme",
      country: "AT",
      employee_count: 100,
      annual_revenue: "30000000.00",
      balance_sheet_total: "30000000.00",
      sectors: [],
    });
    const row = await testDb.select().from(organizations).where(eq(organizations.id, id));
    expect(row[0].sme_classification).toBe("medium");
    expect(row[0].employee_count).toBe(100);
  });

  it("listOrgs returns rows ordered by legal_name asc", async () => {
    await createOrg({ legal_name: "Bravo", country: "AT", sectors: [] });
    await createOrg({ legal_name: "Alpha", country: "AT", sectors: [] });
    const rows = await listOrgs();
    expect(rows.map((r) => r.legal_name)).toEqual(["Alpha", "Bravo"]);
  });

  it("getOrg returns null for a non-existent id", async () => {
    const r = await getOrg("00000000-0000-0000-0000-000000000999");
    expect(r).toBeNull();
  });

  it("deleteOrg removes the row", async () => {
    const id = await createOrg({ legal_name: "Acme", country: "AT", sectors: [] });
    await deleteOrg(id);
    const r = await getOrg(id);
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
bun run test:integration src/server/orgs.integration.test.ts
```

Expected: FAIL — module `./orgs` not found.

- [ ] **Step 3: Implement `src/server/orgs.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { orgInsertSchema, type OrgInsert } from "@/domain/schemas";
import { classifySme } from "@/domain/sme";

function deriveSme(input: OrgInsert) {
  return classifySme({
    employees: input.employee_count ?? null,
    revenue: input.annual_revenue == null ? null : Number(input.annual_revenue),
    balance: input.balance_sheet_total == null ? null : Number(input.balance_sheet_total),
  });
}

export async function createOrg(raw: unknown): Promise<string> {
  const input = orgInsertSchema.parse(raw);
  const sme = deriveSme(input);
  const [row] = await db
    .insert(organizations)
    .values({
      legal_name: input.legal_name,
      trading_name: input.trading_name,
      country: input.country,
      region: input.region,
      founded_on: input.founded_on?.toISOString().slice(0, 10),
      legal_form: input.legal_form,
      employee_count: input.employee_count,
      annual_revenue: input.annual_revenue,
      balance_sheet_total: input.balance_sheet_total,
      sme_classification: sme,
      sectors: input.sectors,
      narrative: input.narrative,
    })
    .returning({ id: organizations.id });
  revalidatePath("/orgs");
  return row.id;
}

export async function updateOrg(id: string, raw: unknown): Promise<void> {
  const input = orgInsertSchema.parse(raw);
  const sme = deriveSme(input);
  await db
    .update(organizations)
    .set({
      legal_name: input.legal_name,
      trading_name: input.trading_name,
      country: input.country,
      region: input.region,
      founded_on: input.founded_on?.toISOString().slice(0, 10),
      legal_form: input.legal_form,
      employee_count: input.employee_count,
      annual_revenue: input.annual_revenue,
      balance_sheet_total: input.balance_sheet_total,
      sme_classification: sme,
      sectors: input.sectors,
      narrative: input.narrative,
      updated_at: new Date(),
    })
    .where(eq(organizations.id, id));
  revalidatePath("/orgs");
  revalidatePath(`/orgs/${id}`);
}

export async function deleteOrg(id: string): Promise<void> {
  await db.delete(organizations).where(eq(organizations.id, id));
  revalidatePath("/orgs");
}

export async function listOrgs() {
  return db.select().from(organizations).orderBy(asc(organizations.legal_name));
}

export async function getOrg(id: string) {
  const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Run — expect green**

```bash
bun run test:integration src/server/orgs.integration.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add organizations CRUD server actions with sme derivation"
```

---

## Task 12: Server actions for projects CRUD (TDD, integration)

**Files:**
- Create: `src/server/projects.ts`, `src/server/projects.integration.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/server/projects.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { closeDb, resetDb, testDb } from "../../tests/db";
import { createOrg } from "./orgs";
import { createProject, listProjects, getProject, updateProject, deleteProject } from "./projects";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await closeDb();
});

async function seedOrg() {
  return createOrg({ legal_name: "Acme", country: "AT", sectors: [] });
}

describe("createProject", () => {
  it("inserts a project linked to org with default status=idea", async () => {
    const orgId = await seedOrg();
    const id = await createProject({
      organization_id: orgId,
      title: "Project Alpha",
      domain: [],
      consortium_partners: [],
      sectors: [],
    } as never);
    const row = await testDb.select().from(projects).where(eq(projects.id, id));
    expect(row[0].title).toBe("Project Alpha");
    expect(row[0].status).toBe("idea");
    expect(row[0].currency).toBe("EUR");
  });

  it("rejects funding_gap > total_budget at validation layer", async () => {
    const orgId = await seedOrg();
    await expect(
      createProject({
        organization_id: orgId,
        title: "X",
        total_budget: "1000.00",
        funding_gap: "9999.00",
        domain: [],
        consortium_partners: [],
      } as never)
    ).rejects.toThrow();
  });

  it("rejects unknown organization_id (FK violation)", async () => {
    await expect(
      createProject({
        organization_id: "00000000-0000-0000-0000-000000000999",
        title: "Orphan",
        domain: [],
        consortium_partners: [],
      } as never)
    ).rejects.toThrow();
  });
});

describe("update / delete / list / get projects", () => {
  it("listProjects with org filter returns only matching", async () => {
    const orgA = await seedOrg();
    const orgB = await createOrg({ legal_name: "Bravo", country: "DE", sectors: [] });
    await createProject({ organization_id: orgA, title: "P1", domain: [], consortium_partners: [] } as never);
    await createProject({ organization_id: orgB, title: "P2", domain: [], consortium_partners: [] } as never);
    const a = await listProjects({ organization_id: orgA });
    expect(a.map((r) => r.title)).toEqual(["P1"]);
  });

  it("update changes status and persists", async () => {
    const orgId = await seedOrg();
    const id = await createProject({
      organization_id: orgId,
      title: "P",
      domain: [],
      consortium_partners: [],
    } as never);
    await updateProject(id, {
      organization_id: orgId,
      title: "P",
      status: "seeking_funding",
      domain: [],
      consortium_partners: [],
    } as never);
    const row = await getProject(id);
    expect(row?.status).toBe("seeking_funding");
  });

  it("delete removes row", async () => {
    const orgId = await seedOrg();
    const id = await createProject({
      organization_id: orgId,
      title: "P",
      domain: [],
      consortium_partners: [],
    } as never);
    await deleteProject(id);
    expect(await getProject(id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
bun run test:integration src/server/projects.integration.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/projects.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq, asc, and, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { projectInsertSchema } from "@/domain/schemas";

export async function createProject(raw: unknown): Promise<string> {
  const input = projectInsertSchema.parse(raw);
  const [row] = await db
    .insert(projects)
    .values({
      organization_id: input.organization_id,
      title: input.title,
      summary: input.summary,
      status: input.status,
      trl: input.trl,
      domain: input.domain,
      total_budget: input.total_budget,
      funding_gap: input.funding_gap,
      currency: input.currency,
      timeline_start: input.timeline_start?.toISOString().slice(0, 10),
      timeline_end: input.timeline_end?.toISOString().slice(0, 10),
      duration_months: input.duration_months,
      consortium_partners: input.consortium_partners,
      equity_willingness: input.equity_willingness,
      narrative: input.narrative,
    })
    .returning({ id: projects.id });
  revalidatePath("/projects");
  return row.id;
}

export async function updateProject(id: string, raw: unknown): Promise<void> {
  const input = projectInsertSchema.parse(raw);
  await db
    .update(projects)
    .set({
      organization_id: input.organization_id,
      title: input.title,
      summary: input.summary,
      status: input.status,
      trl: input.trl,
      domain: input.domain,
      total_budget: input.total_budget,
      funding_gap: input.funding_gap,
      currency: input.currency,
      timeline_start: input.timeline_start?.toISOString().slice(0, 10),
      timeline_end: input.timeline_end?.toISOString().slice(0, 10),
      duration_months: input.duration_months,
      consortium_partners: input.consortium_partners,
      equity_willingness: input.equity_willingness,
      narrative: input.narrative,
      updated_at: new Date(),
    })
    .where(eq(projects.id, id));
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/projects");
}

export async function listProjects(filter?: { organization_id?: string }) {
  const where: SQL[] = [];
  if (filter?.organization_id) where.push(eq(projects.organization_id, filter.organization_id));
  return db
    .select()
    .from(projects)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(projects.title));
}

export async function getProject(id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Run — expect green**

```bash
bun run test:integration src/server/projects.integration.test.ts
```

Expected: 6 passed. If FK-violation test errors with a Drizzle/postgres error type other than `Error`, adjust the test's expectation accordingly (rejects with `Error` is the umbrella).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add projects CRUD server actions with FK and validation"
```

---

## Task 13: App layout + nav

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/components/layout/Nav.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/Nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Funding Advisor",
  description: "Match orgs and projects to EU funding programs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        <main className="container mx-auto p-6 max-w-6xl">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `src/components/layout/Nav.tsx`**

```tsx
import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/orgs", label: "Organizations" },
  { href: "/projects", label: "Projects" },
];

export function Nav() {
  return (
    <header className="border-b">
      <nav className="container mx-auto max-w-6xl flex items-center gap-6 p-4">
        <Link href="/" className="font-semibold">
          Funding Advisor
        </Link>
        <ul className="flex gap-4 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: Replace `src/app/page.tsx` with a placeholder dashboard**

```tsx
import { listOrgs } from "@/server/orgs";
import { listProjects } from "@/server/projects";

export default async function DashboardPage() {
  const [orgs, projects] = await Promise.all([listOrgs(), listProjects()]);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Organizations" value={orgs.length} />
        <Stat label="Projects" value={projects.length} />
        <Stat label="Active funding pursuits" value={projects.filter((p) => p.status === "seeking_funding").length} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build + Playwright smoke goes green**

```bash
bun run build && bun run e2e
```

Expected: build succeeds, Playwright smoke `home page loads` PASSES (title now matches `/funding/i`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add layout, nav, and dashboard placeholder"
```

---

## Task 14: Org list page and form component

**Files:**
- Create: `src/app/orgs/page.tsx`, `src/components/master-data/OrgForm.tsx`

- [ ] **Step 1: Create `src/components/master-data/OrgForm.tsx`**

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { orgInsertSchema, type OrgInsert } from "@/domain/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  initial?: Partial<OrgInsert>;
  action: (data: OrgInsert) => Promise<{ id: string } | void>;
  submitLabel?: string;
};

export function OrgForm({ initial, action, submitLabel = "Save" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgInsert>({
    resolver: zodResolver(orgInsertSchema),
    defaultValues: {
      legal_name: initial?.legal_name ?? "",
      country: initial?.country ?? "AT",
      sectors: initial?.sectors ?? [],
      ...initial,
    } as OrgInsert,
  });

  const onSubmit = (data: OrgInsert) =>
    start(async () => {
      const r = await action(data);
      const id = r && "id" in r ? r.id : null;
      router.push(id ? `/orgs/${id}` : "/orgs");
      router.refresh();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      <Field label="Legal name" error={errors.legal_name?.message}>
        <Input {...register("legal_name")} />
      </Field>
      <Field label="Trading name" error={errors.trading_name?.message}>
        <Input {...register("trading_name")} />
      </Field>
      <Field label="Country (ISO-2)" error={errors.country?.message}>
        <Input {...register("country")} maxLength={2} />
      </Field>
      <Field label="Region (NUTS-2)" error={errors.region?.message}>
        <Input {...register("region")} />
      </Field>
      <Field label="Legal form" error={errors.legal_form?.message}>
        <Input {...register("legal_form")} placeholder="GmbH, AG, …" />
      </Field>
      <Field label="Employees" error={errors.employee_count?.message}>
        <Input
          type="number"
          min={0}
          {...register("employee_count", {
            setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
          })}
        />
      </Field>
      <Field label="Annual revenue (EUR)" error={errors.annual_revenue?.message}>
        <Input {...register("annual_revenue")} placeholder="0.00" />
      </Field>
      <Field label="Balance sheet total (EUR)" error={errors.balance_sheet_total?.message}>
        <Input {...register("balance_sheet_total")} placeholder="0.00" />
      </Field>
      <Field label="Sectors (comma-separated NACE codes)" error={errors.sectors?.message}>
        <Input
          {...register("sectors", {
            setValueAs: (v) =>
              typeof v === "string"
                ? v.split(",").map((s) => s.trim()).filter(Boolean)
                : v,
          })}
        />
      </Field>
      <Field label="Narrative" error={errors.narrative?.message}>
        <Textarea {...register("narrative")} rows={4} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Install RHF resolvers**

```bash
bun add react-hook-form @hookform/resolvers
```

- [ ] **Step 3: Create `src/app/orgs/page.tsx`**

```tsx
import Link from "next/link";
import { listOrgs } from "@/server/orgs";
import { Button } from "@/components/ui/button";

export default async function OrgsPage() {
  const orgs = await listOrgs();
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <Button asChild>
          <Link href="/orgs/new">New organization</Link>
        </Button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Country</th>
            <th>SME</th>
            <th>Employees</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id} className="border-b hover:bg-muted/40">
              <td className="py-2">
                <Link href={`/orgs/${o.id}`} className="hover:underline">
                  {o.legal_name}
                </Link>
              </td>
              <td>{o.country}</td>
              <td>{o.sme_classification}</td>
              <td>{o.employee_count ?? "—"}</td>
              <td>{o.created_at.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
          {orgs.length === 0 && (
            <tr>
              <td className="py-4 text-muted-foreground" colSpan={5}>
                No organizations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
bun run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add organizations list page and shared OrgForm component"
```

---

## Task 15: Org create page

**Files:**
- Create: `src/app/orgs/new/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { OrgForm } from "@/components/master-data/OrgForm";
import { createOrg } from "@/server/orgs";

export default function NewOrgPage() {
  async function action(data: Parameters<typeof createOrg>[0]) {
    "use server";
    const id = await createOrg(data);
    return { id };
  }
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">New organization</h1>
      <OrgForm action={action} submitLabel="Create" />
    </section>
  );
}
```

- [ ] **Step 2: Verify**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): add organization create page"
```

---

## Task 16: Org detail/edit page

**Files:**
- Create: `src/app/orgs/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import { getOrg, updateOrg, deleteOrg } from "@/server/orgs";
import { OrgForm } from "@/components/master-data/OrgForm";
import { listProjects } from "@/server/projects";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrg(id);
  if (!org) notFound();
  const projects = await listProjects({ organization_id: id });

  async function update(data: Parameters<typeof updateOrg>[1]) {
    "use server";
    await updateOrg(id, data);
  }

  async function remove() {
    "use server";
    await deleteOrg(id);
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{org.legal_name}</h1>
        <form action={remove}>
          <Button type="submit" variant="destructive">
            Delete
          </Button>
        </form>
      </div>

      <OrgForm
        initial={{
          legal_name: org.legal_name,
          trading_name: org.trading_name ?? undefined,
          country: org.country,
          region: org.region ?? undefined,
          legal_form: org.legal_form ?? undefined,
          employee_count: org.employee_count ?? undefined,
          annual_revenue: org.annual_revenue ?? undefined,
          balance_sheet_total: org.balance_sheet_total ?? undefined,
          sectors: org.sectors ?? [],
          narrative: org.narrative ?? undefined,
        }}
        action={update}
        submitLabel="Save changes"
      />

      <div>
        <h2 className="text-xl font-semibold mb-2">Projects</h2>
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="hover:underline">
                {p.title}
              </Link>{" "}
              <span className="text-sm text-muted-foreground">({p.status})</span>
            </li>
          ))}
          {projects.length === 0 && <li className="text-muted-foreground">None yet.</li>}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): add organization detail/edit/delete page"
```

---

## Task 17: Project list page + form component

**Files:**
- Create: `src/app/projects/page.tsx`, `src/components/master-data/ProjectForm.tsx`

- [ ] **Step 1: Create `src/components/master-data/ProjectForm.tsx`**

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  projectInsertSchema,
  projectStatusEnum,
  equityWillingnessEnum,
  type ProjectInsert,
} from "@/domain/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Org = { id: string; legal_name: string };

type Props = {
  orgs: Org[];
  initial?: Partial<ProjectInsert>;
  action: (data: ProjectInsert) => Promise<{ id: string } | void>;
  submitLabel?: string;
};

export function ProjectForm({ orgs, initial, action, submitLabel = "Save" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectInsert>({
    resolver: zodResolver(projectInsertSchema),
    defaultValues: {
      organization_id: initial?.organization_id ?? orgs[0]?.id,
      title: initial?.title ?? "",
      status: initial?.status ?? "idea",
      currency: initial?.currency ?? "EUR",
      domain: initial?.domain ?? [],
      consortium_partners: initial?.consortium_partners ?? [],
      ...initial,
    } as ProjectInsert,
  });

  const onSubmit = (data: ProjectInsert) =>
    start(async () => {
      const r = await action(data);
      const id = r && "id" in r ? r.id : null;
      router.push(id ? `/projects/${id}` : "/projects");
      router.refresh();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      <Field label="Organization" error={errors.organization_id?.message}>
        <select className="border rounded px-2 py-1 w-full" {...register("organization_id")}>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.legal_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title" error={errors.title?.message}>
        <Input {...register("title")} />
      </Field>
      <Field label="Summary" error={errors.summary?.message}>
        <Textarea {...register("summary")} rows={3} />
      </Field>
      <Field label="Status" error={errors.status?.message}>
        <select className="border rounded px-2 py-1 w-full" {...register("status")}>
          {projectStatusEnum.options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="TRL (1–9)" error={errors.trl?.message}>
        <Input
          type="number"
          min={1}
          max={9}
          {...register("trl", {
            setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
          })}
        />
      </Field>
      <Field label="Domains (comma-separated)" error={errors.domain?.message}>
        <Input
          {...register("domain", {
            setValueAs: (v) =>
              typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v,
          })}
        />
      </Field>
      <Field label="Total budget (EUR)" error={errors.total_budget?.message}>
        <Input {...register("total_budget")} placeholder="0.00" />
      </Field>
      <Field label="Funding gap (EUR)" error={errors.funding_gap?.message}>
        <Input {...register("funding_gap")} placeholder="0.00" />
      </Field>
      <Field label="Currency (ISO-3)" error={errors.currency?.message}>
        <Input {...register("currency")} maxLength={3} />
      </Field>
      <Field label="Timeline start" error={errors.timeline_start?.message}>
        <Input type="date" {...register("timeline_start")} />
      </Field>
      <Field label="Timeline end" error={errors.timeline_end?.message}>
        <Input type="date" {...register("timeline_end")} />
      </Field>
      <Field label="Duration (months)" error={errors.duration_months?.message}>
        <Input
          type="number"
          min={1}
          {...register("duration_months", {
            setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
          })}
        />
      </Field>
      <Field label="Equity willingness" error={errors.equity_willingness?.message}>
        <select className="border rounded px-2 py-1 w-full" {...register("equity_willingness")}>
          <option value="">—</option>
          {equityWillingnessEnum.options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Narrative" error={errors.narrative?.message}>
        <Textarea {...register("narrative")} rows={4} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

(Consortium-partners array editor deferred to Plan B's polish; the field defaults to `[]` and is accepted at the API level today.)

- [ ] **Step 2: Create `src/app/projects/page.tsx`**

```tsx
import Link from "next/link";
import { listProjects } from "@/server/projects";
import { listOrgs } from "@/server/orgs";
import { Button } from "@/components/ui/button";

export default async function ProjectsPage() {
  const [projects, orgs] = await Promise.all([listProjects(), listOrgs()]);
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild disabled={orgs.length === 0}>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>
      {orgs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Create an organization first.
        </p>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Title</th>
            <th>Org</th>
            <th>Status</th>
            <th>TRL</th>
            <th>Funding gap</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b hover:bg-muted/40">
              <td className="py-2">
                <Link href={`/projects/${p.id}`} className="hover:underline">
                  {p.title}
                </Link>
              </td>
              <td>{orgById.get(p.organization_id)?.legal_name ?? "—"}</td>
              <td>{p.status}</td>
              <td>{p.trl ?? "—"}</td>
              <td>{p.funding_gap ?? "—"}</td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td className="py-4 text-muted-foreground" colSpan={5}>
                No projects yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add projects list page and shared ProjectForm component"
```

---

## Task 18: Project create page

**Files:**
- Create: `src/app/projects/new/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { ProjectForm } from "@/components/master-data/ProjectForm";
import { createProject } from "@/server/projects";
import { listOrgs } from "@/server/orgs";

export default async function NewProjectPage() {
  const orgs = (await listOrgs()).map((o) => ({ id: o.id, legal_name: o.legal_name }));
  async function action(data: Parameters<typeof createProject>[0]) {
    "use server";
    const id = await createProject(data);
    return { id };
  }
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">New project</h1>
      <ProjectForm orgs={orgs} action={action} submitLabel="Create" />
    </section>
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
git commit -m "feat(ui): add project create page"
```

---

## Task 19: Project detail/edit/delete page

**Files:**
- Create: `src/app/projects/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import { getProject, updateProject, deleteProject } from "@/server/projects";
import { listOrgs, getOrg } from "@/server/orgs";
import { ProjectForm } from "@/components/master-data/ProjectForm";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [orgs, parent] = await Promise.all([listOrgs(), getOrg(project.organization_id)]);

  async function update(data: Parameters<typeof updateProject>[1]) {
    "use server";
    await updateProject(id, data);
  }

  async function remove() {
    "use server";
    await deleteProject(id);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        <form action={remove}>
          <Button type="submit" variant="destructive">
            Delete
          </Button>
        </form>
      </div>
      {parent && (
        <p className="text-sm text-muted-foreground">
          Belongs to{" "}
          <Link href={`/orgs/${parent.id}`} className="underline">
            {parent.legal_name}
          </Link>
        </p>
      )}
      <ProjectForm
        orgs={orgs.map((o) => ({ id: o.id, legal_name: o.legal_name }))}
        initial={{
          organization_id: project.organization_id,
          title: project.title,
          summary: project.summary ?? undefined,
          status: project.status,
          trl: project.trl ?? undefined,
          domain: project.domain ?? [],
          total_budget: project.total_budget ?? undefined,
          funding_gap: project.funding_gap ?? undefined,
          currency: project.currency,
          equity_willingness: project.equity_willingness ?? undefined,
          consortium_partners: (project.consortium_partners as never) ?? [],
          narrative: project.narrative ?? undefined,
        }}
        action={update}
        submitLabel="Save changes"
      />
    </section>
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
git commit -m "feat(ui): add project detail/edit/delete page"
```

---

## Task 20: End-to-end smoke (Playwright)

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

This test exercises the whole CRUD path. Runs against `bun run dev` (which Playwright starts).

- [ ] **Step 1: Reset the DB before the test**

We need a clean DB. Add a global setup that calls `resetDb`. Create `tests/e2e/global-setup.ts`:

```ts
import { resetDb, closeDb } from "../db";

export default async function globalSetup() {
  await resetDb();
  await closeDb();
}
```

Update `playwright.config.ts` to add `globalSetup: "./tests/e2e/global-setup.ts"` inside `defineConfig` (string path, not `require.resolve` — Next 16 + Bun is ESM-only and `require` is unreliable).

- [ ] **Step 2: Replace `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

const NAME = "E2E Acme GmbH";
const PROJECT = "E2E Project Alpha";

test("home → create org → create project → see them", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/funding/i);

  // Create org
  await page.getByRole("link", { name: "Organizations" }).click();
  await page.getByRole("link", { name: "New organization" }).click();
  await page.getByLabel("Legal name").fill(NAME);
  await page.getByLabel("Country (ISO-2)").fill("AT");
  await page.getByLabel("Employees").fill("5");
  await page.getByLabel("Annual revenue (EUR)").fill("1000000.00");
  await page.getByLabel("Balance sheet total (EUR)").fill("1000000.00");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();

  // SME class derived
  await page.getByRole("link", { name: "Organizations" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`${NAME}.*micro`) })).toBeVisible();

  // Create project under that org
  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("link", { name: "New project" }).click();
  await page.getByLabel("Title").fill(PROJECT);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: PROJECT })).toBeVisible();

  // Verify in projects list
  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("row", { name: new RegExp(PROJECT) })).toBeVisible();
});
```

- [ ] **Step 3: Run**

```bash
bun run e2e
```

Expected: PASS. If the dev server hasn't built yet, Playwright waits up to 120s for it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(e2e): add full-CRUD smoke covering org and project creation"
```

---

## Task 21: Production deploy (Vercel + Neon + password protection)

**Files:**
- Create: `vercel.json` (optional, for build config)
- No code commits — most actions in dashboards. Document in commit message.

- [ ] **Step 1: Create a Neon project and a `prod` branch**

In the Neon console:
1. Create project `funding-advisor`.
2. Copy the connection string for the `prod` branch (default branch).
3. Note: per your db rules, future feat branches will get their own Neon branches; out of scope for this plan.

- [ ] **Step 2: Push the repo to GitHub**

```bash
gh repo create funding-advisor --private --source=. --remote=origin --push --branch feat/bootstrap-crud
```

(Or create the repo via the GitHub UI and `git push -u origin feat/bootstrap-crud`.)

- [ ] **Step 3: Connect to Vercel**

```bash
vercel link
```

Follow the prompts to link the project.

- [ ] **Step 4: Set the production env var**

```bash
vercel env add DATABASE_URL production
# paste the Neon prod URL
```

- [ ] **Step 5: Run migrations against prod**

```bash
DATABASE_URL="<neon-prod-url>" bun run db:migrate
```

- [ ] **Step 6: Deploy preview**

```bash
vercel
```

Expected: a preview URL. Smoke-test by opening it.

- [ ] **Step 7: Enable Vercel password protection**

In the Vercel dashboard: Project → Settings → Deployment Protection → enable "Password Protection" (Pro plan) OR "Standard Protection" (Hobby) using a single shared password.

- [ ] **Step 8: Promote to production**

Open a PR `feat/bootstrap-crud` → `main`, merge, and Vercel auto-deploys to the production URL. Smoke-test the prod URL with the password.

- [ ] **Step 9: Tag and document**

```bash
git checkout main && git pull
git tag -a v0.1.0 -m "Plan A complete: master-data CRUD on Vercel + Neon"
git push origin v0.1.0
```

---

## Verification checklist (run before declaring Plan A done)

- [ ] `bun run test` — all unit tests pass
- [ ] `bun run test:integration` — all integration tests pass
- [ ] `bun run e2e` — E2E smoke passes
- [ ] `bun run build` — clean production build, no TS errors
- [ ] `bun run lint` — clean
- [ ] Manual: at the prod URL, can create an org, create a project, edit both, delete both
- [ ] Manual: SME classification visible and correct in the org list

## Spec coverage check

- ✓ `organizations` table — Task 9
- ✓ `projects` table — Task 9
- ✓ `narrative` field on both — Task 9
- ✓ Server Actions for CRUD with Zod validation — Tasks 11, 12
- ✓ SME classification stored — Tasks 7, 11
- ✓ Routes `/`, `/orgs`, `/orgs/new`, `/orgs/[id]`, `/projects`, `/projects/new`, `/projects/[id]` — Tasks 13–19
- ✓ `react-hook-form` + Zod with shared schemas — Tasks 14, 17
- ✓ Tailwind + shadcn — Task 2
- ✓ Vitest unit + integration, Playwright smoke — Tasks 3, 4, 10, 20
- ✓ Vercel deploy + Neon prod + password protection — Task 21
- ⏸ `funding_programs`, `interview_sessions`, `strategy_reports`, `eligibility_results` — explicitly deferred to Plans B/C/D
- ⏸ `/catalog`, `/orgs/[id]/interview`, `/projects/[id]/strategy` — Plans B/C/D
- ⏸ Consortium-partners array editor — Plan B (defaults to `[]` here)
