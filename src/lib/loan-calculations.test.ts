import { describe, expect, it } from "vitest";

import {
  buildLoanSchedule,
  calculateFinancingComparison,
} from "@/lib/loan-calculations";

describe("loan calculations", () => {
  it("amortizes a zero-interest annuity exactly", () => {
    const schedule = buildLoanSchedule({
      principal: 120_000,
      termMonths: 3,
      amortizationType: "ANNUITY",
      monthlyFee: 0,
      startMonth: "2026-08",
      rates: [{ startMonth: "2026-08", annualInterestBps: 0 }],
    });

    expect(schedule.map((row) => row.totalAmount)).toEqual([40_000, 40_000, 40_000]);
    expect(schedule.at(-1)?.closingPrincipal).toBe(0);
  });

  it("creates declining straight-amortization payments", () => {
    const schedule = buildLoanSchedule({
      principal: 1_200_000,
      termMonths: 12,
      amortizationType: "STRAIGHT",
      monthlyFee: 500,
      startMonth: "2026-08",
      rates: [{ startMonth: "2026-08", annualInterestBps: 600 }],
    });

    expect(schedule[0].totalAmount).toBeGreaterThan(schedule.at(-1)!.totalAmount);
    expect(schedule.at(-1)?.closingPrincipal).toBe(0);
  });

  it("shortens the schedule after an extra payment", () => {
    const schedule = buildLoanSchedule({
      principal: 120_000,
      termMonths: 12,
      amortizationType: "STRAIGHT",
      monthlyFee: 0,
      startMonth: "2026-08",
      rates: [{ startMonth: "2026-08", annualInterestBps: 0 }],
      extraPayments: { "2026-08": 20_000 },
    });

    expect(schedule).toHaveLength(10);
    expect(schedule.at(-1)?.closingPrincipal).toBe(0);
  });

  it("includes interest and fees in the cash comparison", () => {
    const result = calculateFinancingComparison({
      purchasePrice: 1_000_000,
      downPayment: 200_000,
      annualInterestBps: 500,
      termMonths: 24,
      setupFee: 5_000,
      monthlyFee: 300,
      amortizationType: "ANNUITY",
      startMonth: "2026-08",
    });

    expect(result.principal).toBe(800_000);
    expect(result.totalLoanCost).toBeGreaterThan(1_000_000);
    expect(result.extraCostComparedWithCash).toBe(
      result.totalLoanCost - 1_000_000,
    );
  });
});
