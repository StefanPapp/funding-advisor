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
  try {
    revalidatePath("/orgs");
  } catch {}
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
  try {
    revalidatePath("/orgs");
    revalidatePath(`/orgs/${id}`);
  } catch {}
}

export async function deleteOrg(id: string): Promise<void> {
  await db.delete(organizations).where(eq(organizations.id, id));
  try {
    revalidatePath("/orgs");
  } catch {}
}

export async function listOrgs() {
  return db.select().from(organizations).orderBy(asc(organizations.legal_name));
}

export async function getOrg(id: string) {
  const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows[0] ?? null;
}
