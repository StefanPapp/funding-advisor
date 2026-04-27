import { describe, it, expect } from "vitest";
import { classifySme } from "./sme";

describe("classifySme", () => {
  it("returns 'unknown' when employee_count is null", () => {
    expect(classifySme({ employees: null, revenue: 1000, balance: 1000 })).toBe("unknown");
  });

  it("returns 'unknown' when both financials are null", () => {
    expect(classifySme({ employees: 5, revenue: null, balance: null })).toBe("unknown");
  });

  it("returns 'micro' for 5 employees and €1M revenue", () => {
    expect(classifySme({ employees: 5, revenue: 1_000_000, balance: 5_000_000 })).toBe("micro");
  });

  it("returns 'small' when employees=20, revenue=€8M, balance=€20M (revenue gate)", () => {
    expect(classifySme({ employees: 20, revenue: 8_000_000, balance: 20_000_000 })).toBe("small");
  });

  it("returns 'small' when employees=20, revenue=€20M, balance=€8M (balance gate)", () => {
    expect(classifySme({ employees: 20, revenue: 20_000_000, balance: 8_000_000 })).toBe("small");
  });

  it("returns 'medium' for 200 employees, €40M revenue, €40M balance", () => {
    expect(classifySme({ employees: 200, revenue: 40_000_000, balance: 40_000_000 })).toBe("medium");
  });

  it("returns 'large' for 300 employees", () => {
    expect(classifySme({ employees: 300, revenue: 1_000_000, balance: 1_000_000 })).toBe("large");
  });

  it("returns 'large' when financials exceed every ceiling", () => {
    expect(classifySme({ employees: 100, revenue: 100_000_000, balance: 100_000_000 })).toBe("large");
  });

  it("micro boundary: 9 employees + €2M revenue is micro", () => {
    expect(classifySme({ employees: 9, revenue: 2_000_000, balance: 50_000_000 })).toBe("micro");
  });

  it("micro→small: 10 employees crosses to small", () => {
    expect(classifySme({ employees: 10, revenue: 1_000_000, balance: 1_000_000 })).toBe("small");
  });

  it("small→medium: 50 employees crosses to medium", () => {
    expect(classifySme({ employees: 50, revenue: 1_000_000, balance: 1_000_000 })).toBe("medium");
  });
});
