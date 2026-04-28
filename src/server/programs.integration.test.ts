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
