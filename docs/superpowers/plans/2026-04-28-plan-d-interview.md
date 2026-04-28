# Plan D — Conversational Interview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a deep-dive conversational interview for both organizations and projects. Click "Deep-dive" on either page → chat UI walks through a scripted backbone of must-have questions with LLM-driven follow-ups inside each section. After every few turns, a SEPARATE extraction LLM proposes structured field updates the user reviews and applies. Sessions persist in `interview_sessions` and are resumable. End state: the headline narrative-enrichment pattern from the spec works end-to-end.

**Architecture:** Two distinct LLM personas, each in their own module:
1. **Conversational LLM (Sonnet 4.6)** — receives the current scripted question + transcript, decides whether to ask a follow-up or move on (signaled via tool call). Generates one user-facing message per turn.
2. **Extraction LLM (Sonnet 4.6)** — receives the full transcript so far + the master-data schema, returns a structured JSON of proposed field updates. Stored in `interview_sessions.extracted_fields` for the user to review.

The question backbone lives in TypeScript (not YAML — type-safe, no runtime parsing). Branching is shallow; deeper exploration is delegated to the conversational LLM. Sessions store the full message array; resuming = re-loading the array. Apply-diff sidebar lets the user accept/reject/edit per field; accepted updates flow through the existing org/project Server Actions.

**Tech Stack:** Same as Plan C — AI SDK v6 with mocked tests via `MockLanguageModelV3`. New deps: none (the existing chat-UI primitives are enough; we render messages in a simple scrollable container).

**Spec reference:** `docs/superpowers/specs/2026-04-27-funding-advisor-design.md` — sections "Conversational interview flow → Question backbone / Turn loop / Extraction / Apply UX / Termination", "Data model → interview_sessions".

**Branch:** `feat/interview` off `main` (already created).

**Important — APIs change.** Same caveat as before — verify AI SDK shapes against current docs if a tool call doesn't behave as expected. The mock-model patterns from Plan C tasks 3–5 are good references.

---

## Task 0: ✅ Branch created (done by writing this plan)

Skip to T1.

---

## Task 1: Drizzle schema for `interview_sessions` + migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0003_*.sql`

- [ ] **Step 1: Append to `src/db/schema.ts`** (after `eligibility_results`, before its types)

```ts
export const interviewSubjectEnum = pgEnum("interview_subject_type", ["org", "project"]);

export const interview_sessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject_type: interviewSubjectEnum("subject_type").notNull(),
  subject_id: uuid("subject_id").notNull(),
  current_question_id: text("current_question_id"),
  messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
  extracted_fields: jsonb("extracted_fields").notNull().default(sql`'{}'::jsonb`),
  is_complete: boolean("is_complete").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  subjectIdx: index("interview_sessions_subject_idx").on(t.subject_type, t.subject_id),
}));

export type InterviewSession = typeof interview_sessions.$inferSelect;
export type NewInterviewSession = typeof interview_sessions.$inferInsert;
```

Add `boolean` to imports if not already there.

- [ ] **Step 2: Generate + apply migration** (use SQL pipe for local — drizzle-kit's `db:migrate` won't recognize the existing journal):

```bash
bun run db:generate
docker compose exec -T db psql -U dev -d funding_advisor < src/db/migrations/0003_*.sql
```

- [ ] **Step 3: Verify**

```bash
docker compose exec -T db psql -U dev -d funding_advisor -c '\d interview_sessions'
```

Expected: 9 columns, index on `(subject_type, subject_id)`, no FK (subject_id can point to either orgs or projects — polymorphic).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): add interview_sessions table"
```

---

## Task 2: Question backbone (TypeScript)

**Files:**
- Create: `src/interview/scripts.ts`, `src/interview/scripts.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from "vitest";
import { orgScript, projectScript, nextQuestion, answeredQuestionIds } from "./scripts";

describe("orgScript", () => {
  it("contains required questions for legal_form, country, employees, revenue", () => {
    const ids = orgScript.flatMap((s) => s.questions.map((q) => q.id));
    expect(ids).toContain("legal_form");
    expect(ids).toContain("employee_count");
    expect(ids).toContain("annual_revenue");
  });

  it("every required question has a target_field", () => {
    for (const section of orgScript) {
      for (const q of section.questions) {
        if (q.required) expect(q.target_field).toBeTruthy();
      }
    }
  });
});

describe("projectScript", () => {
  it("contains required questions for trl, funding_gap", () => {
    const ids = projectScript.flatMap((s) => s.questions.map((q) => q.id));
    expect(ids).toContain("trl");
    expect(ids).toContain("funding_gap");
  });
});

describe("nextQuestion", () => {
  it("returns the first required question when no answers exist", () => {
    const q = nextQuestion(orgScript, []);
    expect(q?.required).toBe(true);
  });

  it("skips already-answered questions", () => {
    const answered = [orgScript[0].questions[0].id];
    const q = nextQuestion(orgScript, answered);
    expect(q?.id).not.toBe(answered[0]);
  });

  it("returns null when all required answered", () => {
    const allRequired = orgScript.flatMap((s) =>
      s.questions.filter((q) => q.required).map((q) => q.id)
    );
    const q = nextQuestion(orgScript, allRequired);
    expect(q).toBeNull();
  });
});

describe("answeredQuestionIds", () => {
  it("extracts question ids from messages with question metadata", () => {
    const messages = [
      { role: "assistant", content: "What is your legal form?", question_id: "legal_form" },
      { role: "user", content: "GmbH" },
      { role: "assistant", content: "Acknowledged.", acknowledge_for: "legal_form" },
    ];
    expect(answeredQuestionIds(messages)).toEqual(["legal_form"]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `src/interview/scripts.ts`**

```ts
export type Message = {
  role: "user" | "assistant";
  content: string;
  question_id?: string;
  acknowledge_for?: string;
  followup_for?: string;
  timestamp?: string;
};

export type Question = {
  id: string;
  text: string;
  target_field: string;
  required: boolean;
  hint?: string;
};

export type Section = {
  id: string;
  title: string;
  questions: Question[];
};

export const orgScript: Section[] = [
  {
    id: "legal_basics",
    title: "Legal basics",
    questions: [
      { id: "legal_form", text: "What's the legal form? (GmbH, AG, sole trader, …)", target_field: "legal_form", required: true },
      { id: "founded_on", text: "When was the company founded?", target_field: "founded_on", required: true },
      { id: "country", text: "What country is the headquarters in? (ISO-2 code)", target_field: "country", required: true },
    ],
  },
  {
    id: "size",
    title: "Size and financials",
    questions: [
      { id: "employee_count", text: "How many full-time employees do you have?", target_field: "employee_count", required: true },
      { id: "annual_revenue", text: "What was last year's annual revenue (EUR)?", target_field: "annual_revenue", required: true },
      { id: "balance_sheet_total", text: "What's your balance sheet total (EUR)?", target_field: "balance_sheet_total", required: false },
    ],
  },
  {
    id: "context",
    title: "Strategic context",
    questions: [
      {
        id: "narrative",
        text: "In a few sentences — what does the company do and where do you want it to be in 18 months?",
        target_field: "narrative",
        required: true,
      },
    ],
  },
];

export const projectScript: Section[] = [
  {
    id: "scope",
    title: "Scope",
    questions: [
      { id: "summary", text: "Summarize the project in 1-2 sentences.", target_field: "summary", required: true },
      { id: "trl", text: "What's the Technology Readiness Level (1-9)?", target_field: "trl", required: true },
      { id: "domain", text: "Which domains does this project sit in? (climate, deeptech, AI, etc.)", target_field: "domain", required: false },
    ],
  },
  {
    id: "funding",
    title: "Funding",
    questions: [
      { id: "total_budget", text: "What's the total project budget (EUR)?", target_field: "total_budget", required: true },
      { id: "funding_gap", text: "How much external funding do you need (EUR)?", target_field: "funding_gap", required: true },
      { id: "equity_willingness", text: "Are you open to giving up equity? (none / minority / majority)", target_field: "equity_willingness", required: true },
    ],
  },
  {
    id: "timeline",
    title: "Timeline",
    questions: [
      { id: "timeline_start", text: "When do you plan to start?", target_field: "timeline_start", required: false },
      { id: "duration_months", text: "Expected duration in months?", target_field: "duration_months", required: false },
    ],
  },
  {
    id: "context",
    title: "Strategic context",
    questions: [
      {
        id: "narrative",
        text: "What problem does this project solve? Who benefits, and how is it different from existing solutions?",
        target_field: "narrative",
        required: true,
      },
    ],
  },
];

export function answeredQuestionIds(messages: Message[]): string[] {
  // A question is "answered" once we've emitted an acknowledgement for it.
  return messages
    .filter((m) => m.role === "assistant" && m.acknowledge_for)
    .map((m) => m.acknowledge_for!)
    .filter((id, i, arr) => arr.indexOf(id) === i); // dedupe
}

export function nextQuestion(script: Section[], answered: string[]): Question | null {
  for (const section of script) {
    for (const q of section.questions) {
      if (q.required && !answered.includes(q.id)) return q;
    }
  }
  for (const section of script) {
    for (const q of section.questions) {
      if (!answered.includes(q.id)) return q;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run — expect 7 passed**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(interview): add question backbone and progression helpers"
```

---

## Task 3: Conversational LLM (TDD mocked)

**Files:**
- Create: `src/ai/converse.ts`, `src/ai/converse.test.ts`

The conversational LLM receives `(question, transcript)` and emits exactly one of two tool calls:
- `emit_followup({text})` — stay on the question, ask a clarifying follow-up
- `emit_acknowledge({summary})` — move on, optionally summarize

The function returns `{kind: "followup"|"acknowledge", text}` and a token-usage report.

- [ ] **Step 1: Test**

Use the same `MockLanguageModelV3` + `v3ToolCallResult` helper pattern as Plan C T4. Two cases:
1. Mock emits `emit_followup({text:"How many employees again?"})` → function returns `{kind:"followup", text:"How many employees again?"}`
2. Mock emits `emit_acknowledge({summary:"Got it."})` → function returns `{kind:"acknowledge", text:"Got it."}`

```ts
import { describe, it, expect } from "vitest";
import { converseTurn } from "./converse";
import { MockLanguageModelV3 } from "ai/test";

function v3ToolCallResult(calls: Array<{ id: string; name: string; args: object }>) {
  return {
    content: calls.map((c) => ({
      type: "tool-call" as const,
      toolCallId: c.id,
      toolName: c.name,
      input: JSON.stringify(c.args),
    })),
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

const baseQuestion = { id: "legal_form", text: "What's the legal form?", target_field: "legal_form", required: true };

describe("converseTurn", () => {
  it("recognizes a follow-up tool call", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([{ id: "1", name: "emit_followup", args: { text: "Could you specify GmbH or AG?" } }]),
    });
    const r = await converseTurn({
      model,
      question: baseQuestion,
      transcript: [{ role: "user", content: "we're a company" }],
    });
    expect(r.kind).toBe("followup");
    expect(r.text).toBe("Could you specify GmbH or AG?");
  });

  it("recognizes an acknowledge tool call", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([{ id: "1", name: "emit_acknowledge", args: { summary: "Got it — GmbH." } }]),
    });
    const r = await converseTurn({
      model,
      question: baseQuestion,
      transcript: [{ role: "user", content: "GmbH" }],
    });
    expect(r.kind).toBe("acknowledge");
    expect(r.text).toBe("Got it — GmbH.");
  });

  it("falls back to acknowledge with empty text when neither tool fires", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: "text" as const, text: "I'm a teapot" }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
      }),
    });
    const r = await converseTurn({
      model,
      question: baseQuestion,
      transcript: [{ role: "user", content: "x" }],
    });
    expect(r.kind).toBe("acknowledge");
    expect(r.text).toBe("");
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `src/ai/converse.ts`**

```ts
import { generateText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { Message, Question } from "@/interview/scripts";

const followupArgs = z.object({ text: z.string() });
const acknowledgeArgs = z.object({ summary: z.string() });

export type ConverseInput = {
  model: LanguageModel;
  question: Question;
  transcript: Message[];
};

export type ConverseResult = {
  kind: "followup" | "acknowledge";
  text: string;
};

const SYSTEM_PROMPT = `You are interviewing a founder to gather precise data for funding-eligibility matching.

For each turn:
- If the user's latest answer is clear and complete for the current question, call emit_acknowledge() with a one-sentence summary, and stop.
- If the answer is ambiguous, partial, or evasive, call emit_followup() with ONE concise clarifying question and stop.
- Always call exactly one of these two tools. Never just write text.

Be warm but efficient. Don't over-explain. Don't congratulate.`;

export async function converseTurn(input: ConverseInput): Promise<ConverseResult> {
  const { model, question, transcript } = input;

  const userPrompt = `Current scripted question: ${question.text}
Target field: ${question.target_field}
Required: ${question.required}

Recent transcript (oldest first):
${transcript
  .slice(-10)
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n")}`;

  let result: ConverseResult = { kind: "acknowledge", text: "" };

  await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    tools: {
      emit_followup: tool({
        description: "Ask one clarifying follow-up question to dig deeper on the current scripted question.",
        inputSchema: followupArgs,
        execute: async (args) => {
          result = { kind: "followup", text: args.text };
          return "ok";
        },
      }),
      emit_acknowledge: tool({
        description: "Acknowledge the user's answer and signal we should move on.",
        inputSchema: acknowledgeArgs,
        execute: async (args) => {
          result = { kind: "acknowledge", text: args.summary };
          return "ok";
        },
      }),
    },
    maxOutputTokens: 500,
  });

  return result;
}
```

- [ ] **Step 4: Run — expect 3 passed**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ai): add conversational interview turn function"
```

---

## Task 4: Extraction LLM (TDD mocked)

**Files:**
- Create: `src/ai/extract.ts`, `src/ai/extract.test.ts`

Takes `(subject_type, transcript)`, prompts the model with the master-data schema, returns a JSON object of proposed field updates.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from "vitest";
import { extractFields } from "./extract";
import { MockLanguageModelV3 } from "ai/test";

function v3TextResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

describe("extractFields (org)", () => {
  it("extracts org fields from transcript", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3TextResult(JSON.stringify({ legal_form: "GmbH", employee_count: 12, annual_revenue: "850000.00" })),
    });
    const r = await extractFields({
      model,
      subject_type: "org",
      transcript: [
        { role: "assistant", content: "Legal form?" },
        { role: "user", content: "GmbH" },
        { role: "assistant", content: "Headcount and revenue?" },
        { role: "user", content: "12 people, €850k revenue last year" },
      ],
    });
    expect(r.fields).toEqual({ legal_form: "GmbH", employee_count: 12, annual_revenue: "850000.00" });
  });

  it("returns empty object on malformed JSON", async () => {
    const model = new MockLanguageModelV3({ doGenerate: async () => v3TextResult("not json") });
    const r = await extractFields({ model, subject_type: "org", transcript: [] });
    expect(r.fields).toEqual({});
    expect(r.error).toMatch(/parse/i);
  });
});

describe("extractFields (project)", () => {
  it("extracts project fields", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        v3TextResult(JSON.stringify({ trl: 5, total_budget: "1000000.00", equity_willingness: "minority" })),
    });
    const r = await extractFields({
      model,
      subject_type: "project",
      transcript: [{ role: "user", content: "TRL 5, €1M budget, OK with minority equity" }],
    });
    expect(r.fields.trl).toBe(5);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `src/ai/extract.ts`**

```ts
import { generateText, type LanguageModel } from "ai";
import type { Message } from "@/interview/scripts";

export type ExtractInput = {
  model: LanguageModel;
  subject_type: "org" | "project";
  transcript: Message[];
};

export type ExtractResult = {
  fields: Record<string, unknown>;
  error?: string;
};

const ORG_SCHEMA_HINT = `Allowed fields: legal_name (string), trading_name (string), country (2-letter ISO), region (string), founded_on (YYYY-MM-DD), legal_form (string), employee_count (integer), annual_revenue (decimal string "1234.56"), balance_sheet_total (decimal string), sectors (string[] of NACE codes), narrative (string).`;

const PROJECT_SCHEMA_HINT = `Allowed fields: title (string), summary (string), status ("idea"|"planning"|"active"|"seeking_funding"|"funded"), trl (integer 1-9), domain (string[]), total_budget (decimal string), funding_gap (decimal string), currency (3-letter ISO), timeline_start (YYYY-MM-DD), timeline_end (YYYY-MM-DD), duration_months (integer), equity_willingness ("none"|"minority"|"majority"), narrative (string).`;

export async function extractFields(input: ExtractInput): Promise<ExtractResult> {
  const { model, subject_type, transcript } = input;

  const schemaHint = subject_type === "org" ? ORG_SCHEMA_HINT : PROJECT_SCHEMA_HINT;
  const systemPrompt = `You extract structured field values from interview transcripts.

${schemaHint}

Respond ONLY with a JSON object whose keys are field names from the allowed list. Include only fields the user clearly answered. Decimal money fields must be strings like "1234.56". Skip uncertain values.`;

  const userPrompt = transcript.map((m) => `${m.role}: ${m.content}`).join("\n");

  const out = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt || "(empty transcript)",
    maxOutputTokens: 1500,
  });

  try {
    const parsed = JSON.parse(out.text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("expected object");
    }
    return { fields: parsed as Record<string, unknown> };
  } catch (err) {
    return { fields: {}, error: `parse: ${err instanceof Error ? err.message : String(err)}` };
  }
}
```

- [ ] **Step 4: Run — expect 3 passed**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ai): add extraction function for interview transcripts"
```

---

## Task 5: Server actions for interview turns + apply

**Files:**
- Create: `src/server/interview.ts`, `src/server/interview.integration.test.ts`

Three actions:
1. `startSession(subject_type, subject_id)` → upserts the session, returns initial state with the first scripted question
2. `sendTurn(sessionId, userText, models?)` → appends user message, runs `converseTurn`, appends assistant message, returns updated state
3. `applyExtraction(sessionId, models?)` → runs `extractFields`, stores in `extracted_fields`, returns the proposed updates

The user-facing "accept these updates" flow re-uses the existing `updateOrg`/`updateProject` actions, called from the client with the user-edited values.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { closeDb, resetDb, testDb } from "../../tests/db";
import { startSession, sendTurn, applyExtraction } from "./interview";
import { createOrg } from "./orgs";
import { interview_sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MockLanguageModelV3 } from "ai/test";

function v3ToolCallResult(calls: Array<{ id: string; name: string; args: object }>) {
  return {
    content: calls.map((c) => ({
      type: "tool-call" as const,
      toolCallId: c.id,
      toolName: c.name,
      input: JSON.stringify(c.args),
    })),
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

function v3TextResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await closeDb(); });

describe("interview lifecycle", () => {
  it("startSession creates a session for an org", async () => {
    const orgId = await createOrg({ legal_name: "Acme", country: "AT", sectors: [] });
    const s = await startSession("org", orgId);
    expect(s.session.subject_type).toBe("org");
    expect(s.next_question?.required).toBe(true);
  });

  it("sendTurn appends user + assistant messages and follows the LLM tool call", async () => {
    const orgId = await createOrg({ legal_name: "Acme", country: "AT", sectors: [] });
    const s = await startSession("org", orgId);
    const ackModel = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([{ id: "1", name: "emit_acknowledge", args: { summary: "Got it." } }]),
    });
    const updated = await sendTurn(s.session.id, "GmbH", { conversational: ackModel });
    const stored = await testDb.select().from(interview_sessions).where(eq(interview_sessions.id, s.session.id));
    const messages = stored[0].messages as Array<{ role: string; content: string }>;
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(updated.next_question?.id).not.toBe(s.next_question?.id);
  });

  it("applyExtraction runs the extractor and stores the result", async () => {
    const orgId = await createOrg({ legal_name: "Acme", country: "AT", sectors: [] });
    const s = await startSession("org", orgId);
    const ackModel = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([{ id: "1", name: "emit_acknowledge", args: { summary: "Got it." } }]),
    });
    await sendTurn(s.session.id, "GmbH", { conversational: ackModel });
    const extractor = new MockLanguageModelV3({
      doGenerate: async () => v3TextResult(JSON.stringify({ legal_form: "GmbH" })),
    });
    const r = await applyExtraction(s.session.id, { extraction: extractor });
    expect(r.proposed.legal_form).toBe("GmbH");
    const stored = await testDb.select().from(interview_sessions).where(eq(interview_sessions.id, s.session.id));
    expect((stored[0].extracted_fields as Record<string, unknown>).legal_form).toBe("GmbH");
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `src/server/interview.ts`**

```ts
"use server";

import { db } from "@/db/client";
import { interview_sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { LanguageModel } from "ai";
import {
  orgScript,
  projectScript,
  nextQuestion,
  answeredQuestionIds,
  type Message,
  type Question,
} from "@/interview/scripts";
import { converseTurn } from "@/ai/converse";
import { extractFields } from "@/ai/extract";
import { selectModel } from "@/ai/models";

type SubjectType = "org" | "project";

type SessionState = {
  session: typeof interview_sessions.$inferSelect;
  next_question: Question | null;
};

function scriptFor(t: SubjectType) {
  return t === "org" ? orgScript : projectScript;
}

export async function startSession(subject_type: SubjectType, subject_id: string): Promise<SessionState> {
  const existing = await db
    .select()
    .from(interview_sessions)
    .where(eq(interview_sessions.subject_id, subject_id))
    .limit(1);

  if (existing.length > 0 && existing[0].subject_type === subject_type) {
    const next = nextQuestion(scriptFor(subject_type), answeredQuestionIds(existing[0].messages as Message[]));
    return { session: existing[0], next_question: next };
  }

  const [created] = await db
    .insert(interview_sessions)
    .values({ subject_type, subject_id, messages: [] as never, extracted_fields: {} as never })
    .returning();

  const next = nextQuestion(scriptFor(subject_type), []);
  return { session: created, next_question: next };
}

export async function sendTurn(
  sessionId: string,
  userText: string,
  models?: { conversational?: LanguageModel }
): Promise<SessionState> {
  const [s] = await db.select().from(interview_sessions).where(eq(interview_sessions.id, sessionId));
  if (!s) throw new Error(`Session not found: ${sessionId}`);

  const messages = (s.messages as Message[]).slice();
  const answered = answeredQuestionIds(messages);
  const current = nextQuestion(scriptFor(s.subject_type), answered);
  if (!current) {
    return { session: s, next_question: null };
  }

  // Append user turn
  messages.push({
    role: "user",
    content: userText,
    timestamp: new Date().toISOString(),
  });

  const resolved = models?.conversational ?? selectModel("scoring");
  const model = "model" in resolved ? resolved.model : resolved;

  const reply = await converseTurn({ model, question: current, transcript: messages });

  messages.push({
    role: "assistant",
    content: reply.text,
    timestamp: new Date().toISOString(),
    ...(reply.kind === "followup"
      ? { followup_for: current.id }
      : { acknowledge_for: current.id }),
  });

  const [updated] = await db
    .update(interview_sessions)
    .set({ messages: messages as never, updated_at: new Date() })
    .where(eq(interview_sessions.id, sessionId))
    .returning();

  try {
    revalidatePath(`/orgs/${s.subject_id}/interview`);
    revalidatePath(`/projects/${s.subject_id}/interview`);
  } catch {}

  const next = nextQuestion(scriptFor(updated.subject_type), answeredQuestionIds(updated.messages as Message[]));
  return { session: updated, next_question: next };
}

export async function applyExtraction(
  sessionId: string,
  models?: { extraction?: LanguageModel }
): Promise<{ proposed: Record<string, unknown> }> {
  const [s] = await db.select().from(interview_sessions).where(eq(interview_sessions.id, sessionId));
  if (!s) throw new Error(`Session not found: ${sessionId}`);

  const resolved = models?.extraction ?? selectModel("scoring");
  const model = "model" in resolved ? resolved.model : resolved;

  const r = await extractFields({
    model,
    subject_type: s.subject_type,
    transcript: s.messages as Message[],
  });

  await db
    .update(interview_sessions)
    .set({ extracted_fields: r.fields as never, updated_at: new Date() })
    .where(eq(interview_sessions.id, sessionId));

  try {
    revalidatePath(`/orgs/${s.subject_id}/interview`);
    revalidatePath(`/projects/${s.subject_id}/interview`);
  } catch {}

  return { proposed: r.fields };
}

export async function getSession(subject_type: SubjectType, subject_id: string) {
  const [s] = await db
    .select()
    .from(interview_sessions)
    .where(eq(interview_sessions.subject_id, subject_id))
    .limit(1);
  if (!s || s.subject_type !== subject_type) return null;
  const next = nextQuestion(scriptFor(subject_type), answeredQuestionIds(s.messages as Message[]));
  return { session: s, next_question: next };
}
```

- [ ] **Step 4: Run — expect 3 passed**

```bash
DATABASE_URL=postgres://dev:dev@localhost:5432/funding_advisor bun run test:integration src/server/interview.integration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add interview lifecycle actions (start/send/apply)"
```

---

## Task 6: Chat UI component (shared)

**Files:**
- Create: `src/components/interview/Chat.tsx`, `src/components/interview/ApplyDiff.tsx`
- Create: `src/server/interview.action.ts` (action wrappers similar to `strategy.action.ts`)

The Chat component renders messages, lets the user type, and calls the action wrapper. It also has a "Run extraction" button that triggers `applyExtraction` and reveals the apply-diff sidebar.

- [ ] **Step 1: Action wrappers** — `src/server/interview.action.ts`:

```ts
"use server";

import { sendTurn as svcSendTurn, applyExtraction as svcApplyExtraction } from "./interview";
import { revalidatePath } from "next/cache";

export async function sendTurnAction(sessionId: string, userText: string) {
  const r = await svcSendTurn(sessionId, userText);
  return r;
}

export async function applyExtractionAction(sessionId: string) {
  const r = await svcApplyExtraction(sessionId);
  return r;
}
```

- [ ] **Step 2: Chat component** — `src/components/interview/Chat.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendTurnAction, applyExtractionAction } from "@/server/interview.action";
import { useRouter } from "next/navigation";
import { ApplyDiff } from "./ApplyDiff";
import type { Message, Question } from "@/interview/scripts";

type Props = {
  sessionId: string;
  initialMessages: Message[];
  initialQuestion: Question | null;
  initialExtracted: Record<string, unknown>;
  subjectType: "org" | "project";
  subjectId: string;
};

export function Chat(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [messages, setMessages] = useState(props.initialMessages);
  const [currentQ, setCurrentQ] = useState(props.initialQuestion);
  const [text, setText] = useState("");
  const [extracted, setExtracted] = useState(props.initialExtracted);
  const [error, setError] = useState<string | null>(null);

  const onSend = () => {
    if (!text.trim() || pending) return;
    const value = text;
    setText("");
    start(async () => {
      setError(null);
      try {
        const r = await sendTurnAction(props.sessionId, value);
        setMessages(r.session.messages as Message[]);
        setCurrentQ(r.next_question);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const onExtract = () => {
    start(async () => {
      setError(null);
      try {
        const r = await applyExtractionAction(props.sessionId);
        setExtracted(r.proposed);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="border rounded p-4 h-[400px] overflow-y-auto space-y-3 text-sm">
          {messages.length === 0 && (
            <p className="text-muted-foreground">No messages yet. The interview will start with the first scripted question below.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-foreground" : "text-blue-700 dark:text-blue-300"}>
              <span className="font-medium">{m.role === "user" ? "You" : "Interviewer"}:</span> {m.content}
            </div>
          ))}
        </div>

        {currentQ ? (
          <div className="text-sm text-muted-foreground">
            <strong>Current question:</strong> {currentQ.text}
          </div>
        ) : (
          <p className="text-sm text-green-700">All required questions answered.</p>
        )}

        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button onClick={onSend} disabled={pending || !text.trim()}>
              {pending ? "Sending…" : "Send"}
            </Button>
            <Button variant="outline" onClick={onExtract} disabled={pending || messages.length === 0}>
              Run extraction
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <ApplyDiff
        subjectType={props.subjectType}
        subjectId={props.subjectId}
        proposed={extracted}
        onApplied={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 3: Apply-diff sidebar** — `src/components/interview/ApplyDiff.tsx`:

For Plan D MVP, "Apply" actually saves via the existing `updateOrg`/`updateProject` actions. Since those expect a complete payload (Zod-strict), we do a partial update by NOT calling them in this iteration — instead we just display the proposed values and a button that says "Apply manually" linking back to the master-data form. Real per-field merge is deferred.

```tsx
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  subjectType: "org" | "project";
  subjectId: string;
  proposed: Record<string, unknown>;
  onApplied: () => void;
};

export function ApplyDiff({ subjectType, subjectId, proposed }: Props) {
  const entries = Object.entries(proposed);
  const editHref = subjectType === "org" ? `/orgs/${subjectId}` : `/projects/${subjectId}`;

  return (
    <aside className="space-y-3">
      <h2 className="font-semibold">Proposed updates</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Click <em>Run extraction</em> to derive structured field values from the conversation so far.
        </p>
      ) : (
        <>
          <ul className="space-y-2 text-sm">
            {entries.map(([k, v]) => (
              <li key={k} className="border rounded p-2">
                <div className="font-medium">{k}</div>
                <div className="text-muted-foreground break-words">{String(v)}</div>
              </li>
            ))}
          </ul>
          <Button asChild>
            <Link href={editHref}>Open form to apply</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Plan D MVP: copy the proposed values into the master-data form and save. Per-field auto-apply is a follow-up.
          </p>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(interview): add Chat and ApplyDiff components"
```

---

## Task 7: Interview routes (org + project)

**Files:**
- Create: `src/app/orgs/[id]/interview/page.tsx`, `src/app/projects/[id]/interview/page.tsx`
- Modify: `src/app/orgs/[id]/page.tsx` (add Interview button), `src/app/projects/[id]/page.tsx` (add Interview button)

- [ ] **Step 1: Org interview page** — `src/app/orgs/[id]/interview/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getOrg } from "@/server/orgs";
import { startSession } from "@/server/interview";
import { Chat } from "@/components/interview/Chat";
import type { Message } from "@/interview/scripts";

export default async function OrgInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrg(id);
  if (!org) notFound();
  const state = await startSession("org", id);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Deep-dive interview — {org.legal_name}</h1>
      <Chat
        sessionId={state.session.id}
        initialMessages={state.session.messages as Message[]}
        initialQuestion={state.next_question}
        initialExtracted={state.session.extracted_fields as Record<string, unknown>}
        subjectType="org"
        subjectId={id}
      />
    </section>
  );
}
```

- [ ] **Step 2: Project interview page** — `src/app/projects/[id]/interview/page.tsx`:

Same shape, replace org with project and pull from `getProject`.

- [ ] **Step 3: Add buttons** — wire Deep-dive Interview links from the existing detail pages (alongside Strategy/Delete).

In `src/app/orgs/[id]/page.tsx`:
```tsx
<Button asChild variant="outline">
  <Link href={`/orgs/${id}/interview`}>Deep-dive interview</Link>
</Button>
```
Wrap in the same flex group as Delete.

In `src/app/projects/[id]/page.tsx`:
```tsx
<Button asChild variant="outline">
  <Link href={`/projects/${id}/interview`}>Deep-dive interview</Link>
</Button>
```
Place alongside the Strategy + Delete buttons (3-button group).

- [ ] **Step 4: Verify build**

```bash
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add interview pages for org and project + entry buttons"
```

---

## Task 8: E2E smoke (mocked path)

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

Just verify the interview page loads and shows the first question (no LLM call, no message-send).

- [ ] **Step 1: Append to smoke spec** at the end:

```ts
  // Interview page: navigate from project detail
  await page.getByRole("link", { name: "Deep-dive interview", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Deep-dive interview/i })).toBeVisible();
  // First scripted question should be visible
  await expect(page.getByText(/Current question:/i)).toBeVisible();
```

- [ ] **Step 2: Run**

```bash
bun run e2e
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(e2e): smoke covers interview page first-question render"
```

---

## Task 9: Apply migration + deploy v0.4.0

Same shape as Plans A–C. Steps:

- [ ] Migrate `0003` to Neon prod
- [ ] Push branch
- [ ] PR + squash-merge
- [ ] Smoke prod URL
- [ ] Tag `v0.4.0`

LLM credentials should already be on Vercel (set during Plan C deploy if user followed through). If not, the interview page works for the empty/first-question state but `Send` will fail.

---

## Verification checklist

- [ ] `bun run test` — all green (existing 84 + new ~13)
- [ ] `bun run test:integration` — all green (existing 19 + 3)
- [ ] `bun run e2e` — smoke green
- [ ] `bun run build` — clean
- [ ] Manual prod: send a turn, see assistant reply, run extraction, see proposed fields

## Spec coverage check

- ✓ `interview_sessions` table — Task 1
- ✓ Scripted backbone — Task 2 (TypeScript, not YAML — type-safe equivalent)
- ✓ Conversational turn loop — Tasks 3, 5, 6
- ✓ Extraction LLM (separate call) — Tasks 4, 5
- ✓ Apply UX (sidebar with proposed updates) — Task 6
- ✓ Resumable sessions — Task 5 (`startSession` returns existing session if present)
- ⏸ Per-field accept/edit/reject auto-apply (current MVP shows proposed values; user copies to form) — follow-up
- ⏸ Branching question tree — flat list works for v0.4.0
