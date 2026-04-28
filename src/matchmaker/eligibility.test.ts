import { describe, it, expect } from "vitest";
import {
  checkGeography,
  checkSector,
  checkSme,
  checkTrl,
  checkAmount,
  checkDeadline,
  checkLegalForm,
  checkEquity,
  evaluate,
  type FlagState,
} from "./eligibility";
import type { GeographyScope, EligibilityRules } from "@/domain/programs";

describe("checkGeography", () => {
  it("EU scope: any EU country passes", () => {
    expect(checkGeography("AT", { scope: "EU" })).toBe("pass");
    expect(checkGeography("DE", { scope: "EU" })).toBe("pass");
  });
  it("national scope: country must match", () => {
    expect(checkGeography("AT", { scope: "national", countries: ["AT"] })).toBe("pass");
    expect(checkGeography("DE", { scope: "national", countries: ["AT"] })).toBe("fail");
  });
  it("regional scope: country must match (NUTS check deferred)", () => {
    expect(
      checkGeography("AT", { scope: "regional", countries: ["AT"], regions: ["AT13"] })
    ).toBe("pass");
  });
  it("unknown country", () => {
    expect(checkGeography(null, { scope: "EU" })).toBe("unknown");
  });
});

describe("checkSector", () => {
  it("program with no sector restriction passes", () => {
    expect(checkSector(["62.01"], [])).toBe("pass");
  });
  it("matching sector passes", () => {
    expect(checkSector(["62.01"], ["62.01", "62.02"])).toBe("pass");
  });
  it("disjoint sectors fail", () => {
    expect(checkSector(["10.11"], ["62.01"])).toBe("fail");
  });
  it("org has no sectors", () => {
    expect(checkSector([], ["62.01"])).toBe("unknown");
  });
});

describe("checkSme", () => {
  it("not required → pass for anyone", () => {
    expect(checkSme("large", false)).toBe("pass");
    expect(checkSme("micro", false)).toBe("pass");
  });
  it("required + sme = pass", () => {
    expect(checkSme("micro", true)).toBe("pass");
    expect(checkSme("medium", true)).toBe("pass");
  });
  it("required + large = fail", () => {
    expect(checkSme("large", true)).toBe("fail");
  });
  it("required + unknown = unknown", () => {
    expect(checkSme("unknown", true)).toBe("unknown");
  });
  it("not specified → not required", () => {
    expect(checkSme("large", undefined)).toBe("pass");
  });
});

describe("checkTrl", () => {
  it("no range = pass", () => {
    expect(checkTrl(5, undefined)).toBe("pass");
  });
  it("inside range = pass", () => {
    expect(checkTrl(5, [5, 9])).toBe("pass");
    expect(checkTrl(7, [5, 9])).toBe("pass");
  });
  it("one off = warn", () => {
    expect(checkTrl(4, [5, 9])).toBe("warn"); // one below
    expect(checkTrl(10 as never, [5, 9])).toBe("fail"); // hard above (TRL >9 invalid anyway)
  });
  it("more than one off = fail", () => {
    expect(checkTrl(2, [5, 9])).toBe("fail");
  });
  it("null TRL = unknown", () => {
    expect(checkTrl(null, [5, 9])).toBe("unknown");
  });
});

describe("checkAmount", () => {
  it("no caps = pass", () => {
    expect(checkAmount("100000.00", null, null)).toBe("pass");
  });
  it("inside band = pass", () => {
    expect(checkAmount("500000.00", "100000.00", "1000000.00")).toBe("pass");
  });
  it("at min = pass", () => {
    expect(checkAmount("100000.00", "100000.00", "1000000.00")).toBe("pass");
  });
  it("just below min = warn", () => {
    // ≥80% of min counts as warn
    expect(checkAmount("85000.00", "100000.00", "1000000.00")).toBe("warn");
  });
  it("far below min = fail", () => {
    expect(checkAmount("10000.00", "100000.00", "1000000.00")).toBe("fail");
  });
  it("above max = fail", () => {
    expect(checkAmount("2000000.00", "100000.00", "1000000.00")).toBe("fail");
  });
  it("null gap = unknown", () => {
    expect(checkAmount(null, "100000.00", "1000000.00")).toBe("unknown");
  });
});

describe("checkDeadline", () => {
  it("rolling (null deadline) = pass", () => {
    expect(checkDeadline(new Date("2026-06-01"), null)).toBe("pass");
  });
  it("project starts before deadline = pass", () => {
    expect(checkDeadline(new Date("2026-06-01"), new Date("2026-09-01"))).toBe("pass");
  });
  it("project starts after deadline = fail", () => {
    expect(checkDeadline(new Date("2026-09-01"), new Date("2026-06-01"))).toBe("fail");
  });
  it("null timeline_start = unknown", () => {
    expect(checkDeadline(null, new Date("2026-06-01"))).toBe("unknown");
  });
});

describe("checkLegalForm", () => {
  it("no restriction = pass", () => {
    expect(checkLegalForm("GmbH", undefined)).toBe("pass");
  });
  it("matches = pass", () => {
    expect(checkLegalForm("GmbH", ["GmbH", "AG"])).toBe("pass");
  });
  it("does not match = fail", () => {
    expect(checkLegalForm("Sole trader", ["GmbH", "AG"])).toBe("fail");
  });
  it("null org legal form = unknown", () => {
    expect(checkLegalForm(null, ["GmbH"])).toBe("unknown");
  });
});

describe("checkEquity", () => {
  it("non-equity programs always pass regardless of willingness", () => {
    expect(checkEquity("none", "grant")).toBe("pass");
    expect(checkEquity(null, "debt")).toBe("pass");
  });
  it("equity program + willingness = pass", () => {
    expect(checkEquity("minority", "equity")).toBe("pass");
    expect(checkEquity("majority", "equity")).toBe("pass");
  });
  it("equity program + 'none' = fail", () => {
    expect(checkEquity("none", "equity")).toBe("fail");
  });
  it("equity program + null = unknown", () => {
    expect(checkEquity(null, "equity")).toBe("unknown");
  });
});

describe("evaluate", () => {
  const baseOrg = {
    country: "AT",
    sectors: ["62.01"],
    sme_classification: "small",
    legal_form: "GmbH",
  } as const;
  const baseProject = {
    trl: 6,
    funding_gap: "500000.00",
    timeline_start: new Date("2026-06-01"),
    equity_willingness: "minority",
  } as const;
  const baseProgram = {
    id: "00000000-0000-0000-0000-000000000001",
    kind: "grant",
    geography_scope: { scope: "national", countries: ["AT"] },
    sectors: ["62.01"],
    min_amount: "100000.00",
    max_amount: "1000000.00",
    application_deadline: null,
    eligibility_rules: { trl_range: [5, 9] as [number, number], sme_required: true } satisfies EligibilityRules,
  };

  it("happy path → all pass, hard_fail false", () => {
    const r = evaluate(baseOrg, baseProject, baseProgram);
    expect(r.hard_fail).toBe(false);
    expect(r.flags.geography).toBe("pass");
    expect(r.flags.trl).toBe("pass");
  });

  it("any fail flips hard_fail", () => {
    const r = evaluate(
      baseOrg,
      baseProject,
      { ...baseProgram, geography_scope: { scope: "national", countries: ["DE"] } as GeographyScope }
    );
    expect(r.flags.geography).toBe("fail");
    expect(r.hard_fail).toBe(true);
  });

  it("warn does not flip hard_fail", () => {
    const r = evaluate(baseOrg, { ...baseProject, trl: 4 }, baseProgram);
    expect(r.flags.trl).toBe("warn");
    expect(r.hard_fail).toBe(false);
  });

  it("score: pass=1, warn=0.5, fail/unknown=0; aggregated", () => {
    const r = evaluate(baseOrg, baseProject, baseProgram);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
