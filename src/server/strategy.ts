"use server";

import { db } from "@/db/client";
import {
  funding_programs,
  organizations,
  projects,
  strategy_reports,
  eligibility_results,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { evaluate } from "@/matchmaker/eligibility";
import type { GeographyScope, EligibilityRules } from "@/domain/programs";
import { selectModel } from "@/ai/models";
import { researchPrograms } from "@/ai/research";
import { scoreCandidates } from "@/ai/score";
import { generateNarrative } from "@/ai/narrate";

type Stage =
  | { type: "filter"; eligible: number; warn: number; fail: number }
  | { type: "research"; found: number; error?: string }
  | { type: "scoring"; total: number; done: number }
  | { type: "narrative" }
  | { type: "done"; reportId: string };

type Models = {
  scoring?: LanguageModel;
  narrative?: LanguageModel;
  research?: LanguageModel;
};

export type StrategyResult = {
  report_id: string;
  narrative: string;
  stages: Stage[];
};

function isResolvedModel(
  m: LanguageModel | { model: LanguageModel; modelId: string },
): m is { model: LanguageModel; modelId: string } {
  return typeof m === "object" && m !== null && "model" in m && "modelId" in m;
}

export async function generateStrategy(params: {
  projectId: string;
  models?: Models;
  onStage?: (s: Stage) => void;
}): Promise<StrategyResult> {
  const { projectId, models = {}, onStage = () => {} } = params;

  // 1. Load project + org
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, project.organization_id));
  if (!org) throw new Error(`Org not found: ${project.organization_id}`);

  const stages: Stage[] = [];
  const emit = (s: Stage) => {
    stages.push(s);
    onStage(s);
  };

  // 2. Filter
  const orgInput = {
    country: org.country,
    sectors: org.sectors,
    sme_classification: org.sme_classification,
    legal_form: org.legal_form,
  };
  const projectInput = {
    trl: project.trl,
    funding_gap: project.funding_gap,
    timeline_start: project.timeline_start ? new Date(project.timeline_start) : null,
    equity_willingness: project.equity_willingness,
  };

  const evaluateAll = async () => {
    const rows = await db.select().from(funding_programs);
    return rows
      .map((p) => ({
        program: p,
        result: evaluate(orgInput, projectInput, {
          id: p.id,
          kind: p.kind,
          geography_scope: p.geography_scope as GeographyScope,
          sectors: p.sectors,
          min_amount: p.min_amount,
          max_amount: p.max_amount,
          application_deadline: p.application_deadline ? new Date(p.application_deadline) : null,
          eligibility_rules: p.eligibility_rules as EligibilityRules,
        }),
      }))
      .filter((x) => !x.result.hard_fail);
  };

  const filtered = await evaluateAll();

  emit({
    type: "filter",
    eligible: filtered.length,
    warn: filtered.filter((x) =>
      Object.values(x.result.flags).some((f) => f === "warn"),
    ).length,
    fail: 0,
  });

  // 3. Research if too few and a research model is provided
  let candidates = filtered;
  if (candidates.length < 8 && models.research) {
    const research = await researchPrograms({
      model: models.research,
      org: { country: org.country, sectors: org.sectors, legal_form: org.legal_form },
      project: {
        title: project.title,
        summary: project.summary,
        trl: project.trl,
        funding_gap: project.funding_gap,
      },
      currentCount: candidates.length,
    });
    emit({ type: "research", found: research.candidates.length, error: research.error });
    for (const c of research.candidates) {
      await db
        .insert(funding_programs)
        .values({
          ...c,
          application_deadline: c.application_deadline?.toISOString().slice(0, 10),
          last_verified_at: new Date(),
        })
        .onConflictDoNothing({
          target: [funding_programs.provider, funding_programs.program_name],
        });
    }
    candidates = await evaluateAll();
  }

  // 4. Score (top 20)
  const top20 = candidates.slice(0, 20);
  const resolvedScoring = models.scoring ?? selectModel("scoring");
  const scoringModel: LanguageModel = isResolvedModel(resolvedScoring)
    ? resolvedScoring.model
    : resolvedScoring;
  const scoringModelId = isResolvedModel(resolvedScoring)
    ? resolvedScoring.modelId
    : "mock-or-injected";
  emit({ type: "scoring", total: top20.length, done: 0 });
  const scoreOut = await scoreCandidates({
    model: scoringModel,
    org: {
      country: org.country,
      sectors: org.sectors,
      legal_form: org.legal_form,
      sme_classification: org.sme_classification,
    },
    project: {
      title: project.title,
      summary: project.summary,
      trl: project.trl,
      funding_gap: project.funding_gap,
    },
    candidates: top20.map((c) => ({
      id: c.program.id,
      program_name: c.program.program_name,
      provider: c.program.provider,
      kind: c.program.kind,
    })),
  });
  emit({ type: "scoring", total: top20.length, done: scoreOut.scores.length });

  // 5. Narrate (top 8)
  const programById = new Map(top20.map((c) => [c.program.id, c.program]));
  const ranked = scoreOut.scores
    .map((s) => {
      const program = programById.get(s.program_id);
      if (!program) return null;
      return {
        ...s,
        program_name: program.program_name,
        provider: program.provider,
        kind: program.kind,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  const resolvedNarrative = models.narrative ?? selectModel("narrative");
  const narrativeModel: LanguageModel = isResolvedModel(resolvedNarrative)
    ? resolvedNarrative.model
    : resolvedNarrative;
  emit({ type: "narrative" });
  const narr = await generateNarrative({
    model: narrativeModel,
    org: {
      country: org.country,
      sectors: org.sectors,
      legal_form: org.legal_form,
      sme_classification: org.sme_classification,
    },
    project: {
      title: project.title,
      summary: project.summary,
      trl: project.trl,
      funding_gap: project.funding_gap,
    },
    ranked: ranked.slice(0, 8),
  });

  // 6. Persist
  const [report] = await db
    .insert(strategy_reports)
    .values({
      project_id: projectId,
      model_used: scoringModelId,
      input_snapshot: { org, project } as never,
      narrative: narr.narrative,
      summary: {
        plays: ranked.slice(0, 3).map((r, i) => ({
          rank: i + 1,
          program_id: r.program_id,
          amount:
            programById.get(r.program_id)?.typical_amount ??
            programById.get(r.program_id)?.max_amount ??
            null,
          rationale: r.reasoning,
        })),
      } as never,
    })
    .returning({ id: strategy_reports.id });

  for (const s of scoreOut.scores) {
    const matched = top20.find((c) => c.program.id === s.program_id);
    if (!matched) continue;
    await db.insert(eligibility_results).values({
      report_id: report.id,
      program_id: s.program_id,
      score: s.score.toFixed(2),
      flags: matched.result.flags as never,
      reasoning: s.reasoning,
    });
  }

  emit({ type: "done", reportId: report.id });
  return { report_id: report.id, narrative: narr.narrative, stages };
}
