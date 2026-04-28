import type { GeographyScope, EligibilityRules } from "@/domain/programs";

export type FlagState = "pass" | "warn" | "fail" | "unknown";

export type EligibilityFlags = {
  geography: FlagState;
  sector: FlagState;
  sme: FlagState;
  trl: FlagState;
  amount: FlagState;
  deadline: FlagState;
  legal_form: FlagState;
  equity: FlagState;
};

export type EligibilityResult = {
  program_id: string;
  flags: EligibilityFlags;
  hard_fail: boolean;
  score: number; // 0–100
};

type SmeClass = "micro" | "small" | "medium" | "large" | "unknown";
type ProgramKind = "grant" | "equity" | "debt" | "alternative";
type EquityWillingness = "none" | "minority" | "majority" | null;

export function checkGeography(
  orgCountry: string | null,
  scope: GeographyScope
): FlagState {
  if (orgCountry == null) return "unknown";
  if (scope.scope === "EU") {
    if (!scope.countries || scope.countries.length === 0) return "pass";
    return scope.countries.includes(orgCountry) ? "pass" : "fail";
  }
  return scope.countries.includes(orgCountry) ? "pass" : "fail";
}

export function checkSector(
  orgSectors: readonly string[],
  programSectors: readonly string[]
): FlagState {
  if (programSectors.length === 0) return "pass";
  if (orgSectors.length === 0) return "unknown";
  return orgSectors.some((s) => programSectors.includes(s)) ? "pass" : "fail";
}

export function checkSme(smeClass: SmeClass, smeRequired: boolean | undefined): FlagState {
  if (!smeRequired) return "pass";
  if (smeClass === "unknown") return "unknown";
  return smeClass === "large" ? "fail" : "pass";
}

export function checkTrl(
  trl: number | null,
  range: readonly [number, number] | undefined
): FlagState {
  if (!range) return "pass";
  if (trl == null) return "unknown";
  const [min, max] = range;
  if (trl >= min && trl <= max) return "pass";
  if (trl === min - 1 || trl === max + 1) {
    // one TRL off the range counts as borderline
    return trl >= 1 && trl <= 9 ? "warn" : "fail";
  }
  return "fail";
}

export function checkAmount(
  fundingGap: string | null,
  minAmount: string | null,
  maxAmount: string | null
): FlagState {
  if (fundingGap == null) return "unknown";
  const gap = Number(fundingGap);
  const min = minAmount == null ? null : Number(minAmount);
  const max = maxAmount == null ? null : Number(maxAmount);
  if (max != null && gap > max) return "fail";
  if (min != null && gap < min) {
    // within 20% of the floor counts as warn (program might still consider you)
    return gap >= 0.8 * min ? "warn" : "fail";
  }
  return "pass";
}

export function checkDeadline(
  timelineStart: Date | null,
  deadline: Date | null
): FlagState {
  if (deadline == null) return "pass"; // rolling
  if (timelineStart == null) return "unknown";
  return timelineStart <= deadline ? "pass" : "fail";
}

export function checkLegalForm(
  orgLegalForm: string | null,
  allowed: readonly string[] | undefined
): FlagState {
  if (!allowed || allowed.length === 0) return "pass";
  if (orgLegalForm == null) return "unknown";
  return allowed.includes(orgLegalForm) ? "pass" : "fail";
}

export function checkEquity(
  willingness: EquityWillingness,
  kind: ProgramKind
): FlagState {
  if (kind !== "equity") return "pass";
  if (willingness == null) return "unknown";
  return willingness === "none" ? "fail" : "pass";
}

const FLAG_WEIGHT: Record<FlagState, number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  unknown: 0,
};

export function evaluate(
  org: {
    readonly country: string | null;
    readonly sectors: readonly string[];
    readonly sme_classification: SmeClass;
    readonly legal_form: string | null;
  },
  project: {
    readonly trl: number | null;
    readonly funding_gap: string | null;
    readonly timeline_start: Date | null;
    readonly equity_willingness: EquityWillingness;
  },
  program: {
    readonly id: string;
    readonly kind: ProgramKind;
    readonly geography_scope: GeographyScope;
    readonly sectors: readonly string[];
    readonly min_amount: string | null;
    readonly max_amount: string | null;
    readonly application_deadline: Date | null;
    readonly eligibility_rules: EligibilityRules;
  }
): EligibilityResult {
  const flags: EligibilityFlags = {
    geography: checkGeography(org.country, program.geography_scope),
    sector: checkSector(org.sectors, program.sectors),
    sme: checkSme(org.sme_classification, program.eligibility_rules.sme_required),
    trl: checkTrl(project.trl, program.eligibility_rules.trl_range),
    amount: checkAmount(project.funding_gap, program.min_amount, program.max_amount),
    deadline: checkDeadline(project.timeline_start, program.application_deadline),
    legal_form: checkLegalForm(org.legal_form, program.eligibility_rules.legal_forms),
    equity: checkEquity(project.equity_willingness, program.kind),
  };
  const hard_fail = Object.values(flags).some((f) => f === "fail");
  const total = Object.values(flags).reduce((acc, f) => acc + FLAG_WEIGHT[f], 0);
  const score = Math.round((total / Object.keys(flags).length) * 100);
  return { program_id: program.id, flags, hard_fail, score };
}
