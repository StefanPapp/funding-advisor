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
