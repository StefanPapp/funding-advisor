"use server";

import { eq, asc, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { funding_programs } from "@/db/schema";

type Filter = {
  kind?: "grant" | "equity" | "debt" | "alternative";
  country?: string;
};

export async function listPrograms(filter?: Filter) {
  const conds: SQL[] = [];
  if (filter?.kind) conds.push(eq(funding_programs.kind, filter.kind));
  if (filter?.country) {
    // Match EU-wide OR programs whose geography_scope.countries contains the country.
    conds.push(sql`(
      ${funding_programs.geography_scope}->>'scope' = 'EU'
      OR ${funding_programs.geography_scope}->'countries' @> to_jsonb(${filter.country}::text)
    )`);
  }
  const where =
    conds.length === 0
      ? undefined
      : conds.length === 1
        ? conds[0]
        : sql.join(conds, sql` AND `);
  return db
    .select()
    .from(funding_programs)
    .where(where)
    .orderBy(asc(funding_programs.provider), asc(funding_programs.program_name));
}

export async function getProgram(id: string) {
  const rows = await db
    .select()
    .from(funding_programs)
    .where(eq(funding_programs.id, id))
    .limit(1);
  return rows[0] ?? null;
}
