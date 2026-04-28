import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { closeDb, resetDb, testDb } from "../../tests/db";
import { startSession, sendTurn, applyExtraction } from "./interview";
import { createOrg } from "./orgs";
import { interview_sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
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

beforeEach(async () => {
  await resetDb();
  await testDb.execute(sql`TRUNCATE TABLE interview_sessions RESTART IDENTITY CASCADE`);
});
afterAll(async () => {
  await closeDb();
});

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
