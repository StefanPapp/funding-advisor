import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { closeDb, resetDb, testDb } from "../../tests/db";
import { generateStrategy } from "./strategy";
import { createOrg } from "./orgs";
import { createProject } from "./projects";
import { funding_programs, strategy_reports, eligibility_results } from "@/db/schema";
import { sql } from "drizzle-orm";
import { seedPrograms } from "@/db/seeds/programs";
import { MockLanguageModelV3 } from "ai/test";

// V3 helpers — replicate from existing AI tests
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

function v3ToolCallResult(
  calls: Array<{ id: string; name: string; args: object }>,
) {
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

beforeAll(async () => {
  await resetDb();
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

describe("generateStrategy", () => {
  it("runs filter → score → narrate, persists report and eligibility rows", async () => {
    const orgId = await createOrg({
      legal_name: "Acme Strategy Test",
      country: "AT",
      legal_form: "GmbH",
      employee_count: 10,
      annual_revenue: "1000000.00",
      balance_sheet_total: "1000000.00",
      sectors: [],
    });
    const projectId = await createProject({
      organization_id: orgId,
      title: "Project Strategy Test",
      trl: 5,
      funding_gap: "500000.00",
      domain: [],
      consortium_partners: [],
    } as never);

    // Pick first eligible seeded program for the score's program_id
    const allPrograms = await testDb.select().from(funding_programs).limit(1);
    const firstProgramId = allPrograms[0].id;

    const scoringModel = new MockLanguageModelV3({
      doGenerate: async () =>
        v3ToolCallResult([
          {
            id: "1",
            name: "score",
            args: { program_id: firstProgramId, score: 88, reasoning: "fits well" },
          },
        ]),
    });

    const narrativeModel = new MockLanguageModelV3({
      doGenerate: async () => v3TextResult("# Funding Strategy\n\nMock narrative."),
    });

    const r = await generateStrategy({
      projectId,
      models: { scoring: scoringModel, narrative: narrativeModel, research: undefined },
    });
    expect(r.report_id).toBeTruthy();
    expect(r.narrative).toMatch(/Mock narrative/);

    const reports = await testDb.select().from(strategy_reports);
    expect(reports.length).toBe(1);
    const elig = await testDb.select().from(eligibility_results);
    expect(elig.length).toBe(1);
    expect(Number(elig[0].score)).toBe(88);
  });
});
