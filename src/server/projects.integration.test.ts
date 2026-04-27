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
