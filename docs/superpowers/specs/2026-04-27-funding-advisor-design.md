# Funding Advisor — Design Spec

**Date:** 2026-04-27
**Status:** Proposed
**Author:** Stefan Papp (with Claude)

## Purpose

A single-admin web app that:

1. Maintains master data for organizations and the projects they want to fund.
2. Conducts deep-dive conversational interviews to enrich that master data with the soft/strategic context that structured forms can't capture.
3. Produces a funding strategy: a narrative recommendation plus a ranked list of concrete EU funding programs (grants, equity, debt, alternative) with eligibility flags.

The output answers two questions in one report: "what's my funding strategy?" and "what do I do this week?"

## Decisions log

| Topic | Decision | Why |
|---|---|---|
| Funding universe | Mixed: grants + equity + debt + alternative | User intent; generalized schema |
| Catalog source | Hybrid: seed catalog + LLM-assisted research | Auditable for known programs, scalable beyond |
| Master-data UX | Parallel inputs: forms own structured fields, interview enriches | Fast path for power users, deep-dive for context |
| Geographic scope | EU-wide | Includes Horizon Europe, EIC, member-state programs |
| Users | Single admin | No multi-tenancy, no app-level auth |
| Output | Strategy narrative + ranked program list | Combines "what's the plan" and "what do I do" |
| Interview style | Scripted backbone + LLM follow-ups | Guarantees eligibility coverage; feels intelligent |
| Hosting | Vercel + Neon, project-level password | Branch-per-feature DB matches workflow |
| LLM routing | Vercel AI Gateway: Anthropic primary, OpenAI fallback | Resilience for ~zero code |
| Stack | Next.js 16 full-stack + Postgres + Drizzle + AI SDK | Single service, streaming-native, RSC-by-default |
| Matchmaking pipeline | Streaming with visible stages (Option 3) | Best UX for solo tool watching the run |

## Architecture

```
Next.js 16 app (Vercel)
├── UI (App Router, Server Components by default)
│   ├── /                       — dashboard
│   ├── /orgs                   — list, create, edit
│   ├── /orgs/[id]              — detail + deep-dive interview launcher
│   ├── /orgs/[id]/interview    — chat UI (client island)
│   ├── /projects               — list, create, edit
│   ├── /projects/[id]          — detail + interview + strategy launchers
│   ├── /projects/[id]/interview — chat UI (client island)
│   ├── /projects/[id]/strategy  — streamed strategy run + report viewer
│   └── /catalog                — read-only seed-program browser
│
├── Server Actions (writes)
│   ├── orgs.* / projects.*    — CRUD via Drizzle ORM
│   ├── interview.send         — append turn, stream LLM reply, queue extraction
│   └── strategy.generate      — streamed pipeline (filter → research → score → narrate)
│
├── Data layer (Postgres on Neon, Drizzle ORM)
│   ├── organizations
│   ├── projects
│   ├── interview_sessions
│   ├── funding_programs
│   ├── strategy_reports
│   └── eligibility_results
│
├── AI layer (Vercel AI SDK + AI Gateway)
│   ├── primary: anthropic/claude-sonnet-4-6
│   ├── narrative: anthropic/claude-opus-4-7
│   └── fallback: openai/gpt-5
│
└── Auth: Vercel project-level password protection
```

**Key boundaries:**

- The matchmaker (`src/matchmaker/eligibility.ts`) is a pure function over `(Org, Project, FundingProgram[])` — no I/O. I/O lives in the server action that calls it.
- LLM "research" is a tool the server action invokes; results are upserted into `funding_programs` and cached.
- Interview produces both unstructured `narrative` and structured field updates extracted by a separate, audit-friendly LLM call.

## Data model

PKs are `id uuid` (default `gen_random_uuid()`), all tables get `created_at`/`updated_at TIMESTAMPTZ`, money is `NUMERIC(14,2)`.

### `organizations`

Master data for the company seeking funding.

- `legal_name TEXT NOT NULL`, `trading_name TEXT`
- `country CHAR(2) NOT NULL` (ISO-3166), `region TEXT` (NUTS-2)
- `founded_on DATE`
- `legal_form TEXT` (GmbH, AG, sole trader, …) — drives grant eligibility
- `employee_count INT`, `annual_revenue NUMERIC(14,2)`, `balance_sheet_total NUMERIC(14,2)`
- `sme_classification TEXT CHECK (sme_classification IN ('micro','small','medium','large','unknown'))` — derived from EU recommendation 2003/361, stored
- `sectors TEXT[]` (NACE Rev. 2 codes)
- `narrative TEXT` — interview output

### `projects`

A fundable initiative within an org.

- `organization_id UUID NOT NULL REFERENCES organizations(id)`
- `title TEXT NOT NULL`, `summary TEXT`
- `status TEXT CHECK (status IN ('idea','planning','active','seeking_funding','funded'))`
- `trl INT CHECK (trl BETWEEN 1 AND 9)` — Technology Readiness Level
- `domain TEXT[]` (e.g., `["climate","deeptech"]`)
- `total_budget NUMERIC(14,2)`, `funding_gap NUMERIC(14,2)`, `currency CHAR(3) DEFAULT 'EUR'`
- `timeline_start DATE`, `timeline_end DATE`, `duration_months INT`
- `consortium_partners JSONB` — `[{name, country, role}]` for collaborative grants
- `equity_willingness TEXT CHECK (equity_willingness IN ('none','minority','majority'))` — gates VC matches
- `narrative TEXT` — interview output

### `funding_programs`

Unified catalog for all `kind`s.

- `kind TEXT NOT NULL CHECK (kind IN ('grant','equity','debt','alternative'))`
- `provider TEXT NOT NULL`, `program_name TEXT NOT NULL`, `url TEXT`
- `geography_scope JSONB NOT NULL` — `{countries: ["AT","DE",...], regions: ["NUTS2:..."], scope: "EU"|"national"|"regional"}`
- `sectors TEXT[]`, `domains TEXT[]`
- `min_amount NUMERIC(14,2)`, `max_amount NUMERIC(14,2)`, `typical_amount NUMERIC(14,2)`, `currency CHAR(3) DEFAULT 'EUR'`
- `eligibility_rules JSONB NOT NULL` — `{trl_range, sme_required, consortium_required, legal_forms, age_max_years, ...}`
- `application_deadline DATE` (NULL = rolling)
- `source TEXT NOT NULL CHECK (source IN ('seed','llm_research'))` — provenance
- `last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `confidence TEXT CHECK (confidence IN ('high','medium','low'))` — `high` for seed, `medium`/`low` for LLM-discovered

### `interview_sessions`

- `subject_type TEXT CHECK (subject_type IN ('org','project'))`, `subject_id UUID NOT NULL`
- `messages JSONB NOT NULL DEFAULT '[]'::jsonb` — `[{role, content, timestamp}]`
- `extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb` — pending updates the user can apply

### `strategy_reports`

- `project_id UUID NOT NULL REFERENCES projects(id)`
- `generated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `model_used TEXT NOT NULL`
- `input_snapshot JSONB NOT NULL` — frozen org+project state at generation
- `narrative TEXT NOT NULL` (markdown)
- `summary JSONB NOT NULL` — `{plays: [{rank, program_id, amount, rationale}]}`

### `eligibility_results`

- `report_id UUID NOT NULL REFERENCES strategy_reports(id) ON DELETE CASCADE`
- `program_id UUID NOT NULL REFERENCES funding_programs(id)`
- `score NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100)`
- `flags JSONB NOT NULL` — `{geography:"pass", trl:"warn", sme:"pass", ...}`
- `reasoning TEXT` — one-paragraph LLM explanation of fit

### Schema decisions

- One `funding_programs` table polymorphic on `kind`, not four split tables — matchmaking iterates one set, eligibility rules normalize via JSONB.
- `narrative` stored on org/project (not in interviews) so latest synthesis is denormalized and fast to read; sessions are the audit trail.
- `eligibility_results` is separate from `strategy_reports` so we can re-rank without re-narrating.

## UI structure

### Routes

| Route | Type | Purpose |
|---|---|---|
| `/` | Server | Dashboard: orgs count, active projects, recent reports, upcoming deadlines |
| `/orgs` | Server | List + create. Columns: name, country, SME class, # projects |
| `/orgs/new` | Server (form) | Create form |
| `/orgs/[id]` | Server | Detail with inline edit, related projects, "Deep-dive interview" button |
| `/orgs/[id]/interview` | Client | Chat UI; extraction-diff sidebar |
| `/projects` | Server | List + create. Filter by org, status, funding-gap range |
| `/projects/new` | Server (form) | Create form (org picker required) |
| `/projects/[id]` | Server | Detail, deadlines panel, "Deep-dive interview" + "Generate strategy" |
| `/projects/[id]/interview` | Client | Chat UI (same component as org) |
| `/projects/[id]/strategy` | Client | Streaming run + persisted report history |
| `/catalog` | Server | Browse seed funding programs, filter, view details |

### Shared components

- `master-data/OrgForm.tsx` — `react-hook-form` + Zod
- `master-data/ProjectForm.tsx` — same pattern, plus consortium-partners array editor
- `interview/Chat.tsx` — message list, input, streaming indicator, extraction sidebar
- `interview/ExtractionDiff.tsx` — current → proposed per field; accept/edit/reject
- `strategy/StreamRun.tsx` — staged progress + final narrative as it streams
- `strategy/RankedList.tsx` — sortable, eligibility flag chips, click-through
- `strategy/ReportHistory.tsx` — past runs, diff between runs
- `catalog/ProgramCard.tsx`, `catalog/ProgramDetail.tsx`

### State approach

- Server Components by default; `"use client"` only on `Chat`, `StreamRun`, forms.
- URL state via `nuqs` for filter/sort on list pages.
- React Query inside client islands only.
- No global state library.

### Styling

- Tailwind + shadcn/ui, `cn()` helper, no global CSS beyond reset + tokens.

### Forms

- `react-hook-form` + Zod. Same Zod schemas reused server-side in Server Actions.

## Matchmaking algorithm

Two halves: deterministic eligibility filter (fast, auditable) → LLM scoring + narrative (judgment).

### Eligibility filter (`src/matchmaker/eligibility.ts`)

Pure TS function over `(Organization, Project, FundingProgram[])` returning `EligibilityResult[]`.

Per-criterion checks: `geography`, `sector`, `sme`, `trl`, `amount`, `deadline`, `legal_form`, `equity`. Each returns one of `pass | warn | fail | unknown`:

- `pass` — explicitly meets the rule
- `warn` — borderline (e.g., TRL = 4 when range is 5–9)
- `fail` — definitively ineligible
- `unknown` — master-data field is null; surface as warning, prompt user to fill

`hard_fail = true` when any flag is `fail` → program is dropped before LLM scoring. Keeps the LLM context small and prevents hallucination over ineligible programs.

### LLM research

Triggered after the eligibility filter returns < N matches (default `N = 8`). Sonnet 4.6 with web context is prompted with the org+project summary and asked for additional EU programs not yet in catalog. Results upserted into `funding_programs` with `source='llm_research'`, `confidence='medium'`, `last_verified_at=now()`. Eligibility filter re-runs over the expanded set. A program upserted within the last 30 days isn't re-researched.

### LLM scoring + narrative (streamed)

Single chained run with:

- Org + project (compact JSON)
- Top ~20 surviving programs from eligibility filter, with their flags
- Tool `score(program_id, score, reasoning)` — repeated calls, one per program (Sonnet 4.6)
- Tool `narrative(markdown)` — final call, drafts strategy document (Opus 4.7)

The narrative the model is instructed to produce:

1. **Strategy summary** — 3 numbered plays (program + € amount + rationale + sequencing note)
2. **Sequencing** — what to do first, what in parallel, what to deprioritize
3. **Gaps** — fields the org/project should fill to qualify for additional programs

### Streaming UX

Custom data parts emit stage markers; narrative streams as normal text deltas:

```
[STAGE: filter]      Filtered 47 programs → 12 eligible, 8 borderline, 27 ineligible
[STAGE: research]    Researching new opportunities...
[STAGE: research]    Found 4 additional candidates
[STAGE: filter]      Re-filter: 14 eligible, 9 borderline
[STAGE: scoring]     Scoring 14 programs...
[STAGE: narrative]   Drafting strategy...
[NARRATIVE_BEGINS]
# Funding Strategy for Project Acme...
```

### Persistence

When the stream completes successfully:

- Insert one `strategy_reports` row (narrative + input snapshot + summary)
- Insert N `eligibility_results` rows (one per scored program)

If the stream is aborted: nothing persisted (atomic at the report level). Re-running creates a new report; old reports are never overwritten.

## Conversational interview flow

### Question backbone

`interview_scripts/org.yaml` and `interview_scripts/project.yaml` define sections with mandatory + optional questions:

```yaml
sections:
  - id: legal_basics
    questions:
      - id: legal_form
        text: "What's the legal form? (GmbH, AG, sole trader, …)"
        target_field: legal_form
        required: true
      - id: founded_on
        text: "When was the company founded?"
        target_field: founded_on
        required: true
  - id: financials
    questions:
      - id: revenue
        text: "What was last year's annual revenue (EUR)?"
        target_field: annual_revenue
        required: true
        branch:
          - if: { value: 0 }
            ask: "Pre-revenue — when do you expect first revenue?"
            target_field: narrative
```

`target_field` ties a question to a master-data column so extraction can map answers. Branching is shallow; deeper exploration is delegated to the LLM follow-up.

### Turn loop

1. UI loads next scripted question (skipping ones already answered).
2. User types reply.
3. Server action receives turn:
   1. Append `{role:user, content}` to `interview_sessions.messages`.
   2. Stream LLM (Sonnet 4.6) with system prompt: "You are interviewing for funding eligibility data. Current scripted question: {q}. If the user's answer is unclear or incomplete, ask ONE follow-up. Otherwise acknowledge and move on."
   3. Stream reply tokens to client; append to messages on completion.
4. Client decides: follow-up vs move-on, detected via tool calls `emit_followup()` vs `emit_acknowledge()`.
5. Acknowledge → request next scripted question. Followup → stay on this question.
6. Every 4 turns and on session end, the extraction LLM runs in the background.

### Extraction (separate LLM call)

Sonnet 4.6, prompted with the full transcript so far + the master-data schema, returns a JSON object of field updates. Stored in `interview_sessions.extracted_fields`. Separation from the conversational LLM keeps each prompt focused and gives a re-runnable audit trail.

### Apply UX

Sidebar shows pending updates with current → proposed for each field. User accepts per-row or in bulk; updates flow through the same Server Action as the form. Nothing is auto-applied.

### Termination

User can end at any point. The script defines an end condition: all `required: true` questions answered + extraction has produced values for them. Sessions resumable — state is the messages array.

## Error handling

### Domain vs infrastructure errors

```ts
// src/errors.ts
export class IneligibleProgramError extends Error {}     // domain
export class IncompleteMasterDataError extends Error {}  // domain
export class LlmProviderError extends Error {}           // infra (retryable)
export class CatalogStaleError extends Error {}          // infra (retryable)
```

### Retry strategy

- LLM calls: AI Gateway handles primary→fallback automatically; on top, `p-retry` with exponential backoff + jitter for 5xx and rate-limit. Max 3 attempts. Connect 5s, read 60s.
- Drizzle on Neon: retry on serialization failures and connection drops only. Never on constraint violations.
- LLM research tool: malformed JSON → retry once with the validation error appended; second failure → log and continue with current candidates.

### Streaming failures

- Mid-stream error: emit `[STAGE: error]`, render toast, do NOT persist a partial report. Re-run creates a fresh `strategy_reports` row.
- Eligibility-filter throw: bubble up, fail the stream, log full context. This is a bug.

### Validation boundaries

- Server Actions validate input via Zod before DB writes; invalid input returns typed errors to the form.
- LLM tool-call args validated via Zod (`score ∈ [0,100]` etc.).
- DB `CHECK` constraints as last-line defense.

### User-visible errors

- `error.tsx` per route segment, `global-error.tsx` at root.
- "Your data is incomplete" (actionable, link to field) vs "AI service down" (just retry) — distinct messages.

## Testing

### Unit (Vitest)

- `src/matchmaker/eligibility.ts` — table-driven tests, exhaustive over `(org-shape, project-shape, program-shape) → expected flags`. Target >90% coverage. Edge cases: TRL boundaries, geography overlap, SME thresholds, null fields.
- Zod schemas — round-trip validation.
- Extraction-result normalization — unit tests on the JSON parser, not the LLM call.

### Integration (Vitest + testcontainers/pg-mem)

- Server actions against real (or in-memory) Postgres.
- Full eligibility-filter pipeline: insert seed programs, run filter, assert result rows.
- Interview turn loop: post turn, assert messages appended, assert extraction triggers at the right cadence.
- LLM calls mocked at the AI SDK boundary with canned streams.

### E2E (Playwright, smoke-tagged)

- Create org → create project → interview (mocked LLM) → strategy (mocked LLM) → assert report persisted and visible.
- One real-LLM smoke test gated behind `RUN_LIVE_LLM=1`, run manually before releases. Not in CI.

### Coverage target

>80% on business logic (`matchmaker/`, `interview/`, server actions). Boilerplate excluded.

### Out of scope

- Visual rendering tests (rely on Playwright smoke).
- Third-party libraries.
- LLM output quality — non-deterministic; eval harness deferred until matchmaking quality is a real concern.

## Open items / deferred

- Application tracking pipeline (kanban: Identified → Eligible → Applied → Won/Lost) — deferred to post-v1.
- Multi-user / advisor-with-clients model — out of scope.
- Two-phase async generation with Vercel Workflow — graduate to it only if a single run regularly exceeds ~60s.
- Eval harness for LLM matchmaking quality — add when there's enough real-world data to score against.
- Seed catalog content — owned outside this spec; bootstrap with FFG, AWS, Horizon Europe pillars, EIC, EIT KICs, plus a starter set of EU-active VCs.

## References

- EU SME definition: Recommendation 2003/361/EC
- NACE Rev. 2 sector taxonomy
- TRL scale: Horizon Europe definitions (TRL 1–9)
- NUTS-2 regional codes (Eurostat)
