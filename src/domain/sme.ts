export type SmeClass = "micro" | "small" | "medium" | "large" | "unknown";

export type SmeInput = {
  employees: number | null;
  revenue: number | null;
  balance: number | null;
};

export function classifySme({ employees, revenue, balance }: SmeInput): SmeClass {
  if (employees == null) return "unknown";
  if (revenue == null && balance == null) return "unknown";

  // Pick the most favorable financial signal: SME definition uses OR between
  // annual revenue and balance sheet total — meeting EITHER one is sufficient.
  const meetsFinancial = (revenueCap: number, balanceCap: number) => {
    const revenueOk = revenue != null && revenue <= revenueCap;
    const balanceOk = balance != null && balance <= balanceCap;
    return revenueOk || balanceOk;
  };

  if (employees < 10 && meetsFinancial(2_000_000, 2_000_000)) return "micro";
  if (employees < 50 && meetsFinancial(10_000_000, 10_000_000)) return "small";
  if (employees < 250 && meetsFinancial(50_000_000, 43_000_000)) return "medium";
  return "large";
}
