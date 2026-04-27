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
  try {
    revalidatePath("/projects");
  } catch {}
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
  try {
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
  } catch {}
}

export async function deleteProject(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id));
  try {
    revalidatePath("/projects");
  } catch {}
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
