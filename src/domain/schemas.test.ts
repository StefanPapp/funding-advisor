import { describe, it, expect } from "vitest";
import { orgInsertSchema, projectInsertSchema } from "./schemas";

describe("orgInsertSchema", () => {
  it("accepts a minimal valid org", () => {
    const r = orgInsertSchema.safeParse({
      legal_name: "Acme GmbH",
      country: "AT",
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing legal_name", () => {
    const r = orgInsertSchema.safeParse({ country: "AT" });
    expect(r.success).toBe(false);
  });

  it("rejects 3-letter country", () => {
    const r = orgInsertSchema.safeParse({ legal_name: "Acme", country: "AUT" });
    expect(r.success).toBe(false);
  });

  it("coerces empty string trading_name to undefined", () => {
    const r = orgInsertSchema.safeParse({ legal_name: "Acme", country: "AT", trading_name: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.trading_name).toBeUndefined();
  });

  it("accepts sectors array", () => {
    const r = orgInsertSchema.safeParse({
      legal_name: "Acme",
      country: "AT",
      sectors: ["62.01", "62.02"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative employee_count", () => {
    const r = orgInsertSchema.safeParse({
      legal_name: "Acme",
      country: "AT",
      employee_count: -1,
    });
    expect(r.success).toBe(false);
  });
});

describe("projectInsertSchema", () => {
  it("accepts a minimal valid project", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "Project Alpha",
    });
    expect(r.success).toBe(true);
  });

  it("rejects TRL out of range", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      trl: 0,
    });
    expect(r.success).toBe(false);

    const r2 = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      trl: 10,
    });
    expect(r2.success).toBe(false);
  });

  it("rejects bad UUID for organization_id", () => {
    const r = projectInsertSchema.safeParse({ organization_id: "not-a-uuid", title: "X" });
    expect(r.success).toBe(false);
  });

  it("accepts consortium_partners array", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      consortium_partners: [{ name: "Partner A", country: "DE", role: "research" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects funding_gap > total_budget when both set", () => {
    const r = projectInsertSchema.safeParse({
      organization_id: "00000000-0000-0000-0000-000000000001",
      title: "X",
      total_budget: "100000.00",
      funding_gap: "200000.00",
    });
    expect(r.success).toBe(false);
  });
});
