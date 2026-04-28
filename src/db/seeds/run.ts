import { db } from "@/db/client";
import { funding_programs } from "@/db/schema";
import { fundingProgramInsertSchema } from "@/domain/programs";
import { seedPrograms } from "./programs";
import { sql } from "drizzle-orm";

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const raw of seedPrograms) {
    const v = fundingProgramInsertSchema.parse(raw);
    const result = await db
      .insert(funding_programs)
      .values({
        ...v,
        application_deadline: v.application_deadline?.toISOString().slice(0, 10),
        last_verified_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [funding_programs.provider, funding_programs.program_name],
        set: {
          kind: v.kind,
          url: v.url,
          geography_scope: v.geography_scope,
          sectors: v.sectors,
          domains: v.domains,
          min_amount: v.min_amount,
          max_amount: v.max_amount,
          typical_amount: v.typical_amount,
          currency: v.currency,
          eligibility_rules: v.eligibility_rules,
          application_deadline: v.application_deadline?.toISOString().slice(0, 10),
          confidence: v.confidence ?? "medium",
          last_verified_at: new Date(),
          updated_at: new Date(),
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (result[0]?.inserted) inserted++;
    else updated++;
  }
  console.log(`Seed complete: ${inserted} inserted, ${updated} updated`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
