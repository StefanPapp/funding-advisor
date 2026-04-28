"use server";

import { db } from "@/db/client";
import { funding_programs } from "@/db/schema";
import { evaluate, type EligibilityResult } from "@/matchmaker/eligibility";
import type { Organization, Project } from "@/db/schema";
import type { GeographyScope, EligibilityRules } from "@/domain/programs";

type ProgramRow = typeof funding_programs.$inferSelect;

export async function quickMatch(
  org: Organization,
  project: Project
): Promise<Array<EligibilityResult & { program: ProgramRow }>> {
  const programs = await db.select().from(funding_programs);
  const results: Array<EligibilityResult & { program: ProgramRow }> = [];
  for (const program of programs) {
    const r = evaluate(
      {
        country: org.country,
        sectors: org.sectors,
        sme_classification: org.sme_classification,
        legal_form: org.legal_form,
      },
      {
        trl: project.trl,
        funding_gap: project.funding_gap,
        timeline_start: project.timeline_start ? new Date(project.timeline_start) : null,
        equity_willingness: project.equity_willingness,
      },
      {
        id: program.id,
        kind: program.kind,
        geography_scope: program.geography_scope as GeographyScope,
        sectors: program.sectors,
        min_amount: program.min_amount,
        max_amount: program.max_amount,
        application_deadline: program.application_deadline ? new Date(program.application_deadline) : null,
        eligibility_rules: program.eligibility_rules as EligibilityRules,
      }
    );
    results.push({ ...r, program });
  }
  // Eliminate hard fails; sort by score desc.
  return results.filter((r) => !r.hard_fail).sort((a, b) => b.score - a.score);
}
