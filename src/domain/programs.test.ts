import { describe, it, expect } from "vitest";
import { fundingProgramInsertSchema } from "./programs";

const minimal = {
  kind: "grant",
  provider: "FFG",
  program_name: "Basisprogramm",
  geography_scope: { scope: "national", countries: ["AT"] },
  eligibility_rules: {},
  source: "seed",
};

describe("fundingProgramInsertSchema", () => {
  it("accepts a minimal valid program", () => {
    const r = fundingProgramInsertSchema.safeParse(minimal);
    expect(r.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const r = fundingProgramInsertSchema.safeParse({ ...minimal, kind: "weird" });
    expect(r.success).toBe(false);
  });

  it("rejects geography_scope without scope discriminator", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      geography_scope: { countries: ["AT"] },
    });
    expect(r.success).toBe(false);
  });

  it("accepts EU-wide geography (countries optional)", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      geography_scope: { scope: "EU" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts trl_range tuple in eligibility_rules", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      eligibility_rules: { trl_range: [5, 9] },
    });
    expect(r.success).toBe(true);
  });

  it("rejects trl_range with min > max", () => {
    const r = fundingProgramInsertSchema.safeParse({
      ...minimal,
      eligibility_rules: { trl_range: [9, 5] },
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown source", () => {
    const r = fundingProgramInsertSchema.safeParse({ ...minimal, source: "manual" });
    expect(r.success).toBe(false);
  });
});
