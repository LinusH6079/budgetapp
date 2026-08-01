import { describe, expect, it } from "vitest";

import {
  calculateAnnualBudget,
  calculateAnnualBudgetItem,
  netReservedAmount,
} from "@/lib/annual-budget-calculations";

describe("annual budget calculations", () => {
  it("calculates net reserved money from contributions and withdrawals", () => {
    expect(
      netReservedAmount([
        { amount: 5_000, entryType: "CONTRIBUTION" },
        { amount: 1_500, entryType: "WITHDRAWAL" },
      ]),
    ).toBe(3_500);
  });

  it("recommends an even monthly amount including the due month", () => {
    const result = calculateAnnualBudgetItem(
      {
        id: "car-service",
        name: "Bilservice",
        targetAmount: 90_000,
        dueMonth: "2027-04",
        entries: [{ amount: 18_000, entryType: "CONTRIBUTION" }],
      },
      new Date(2026, 7, 1),
    );

    expect(result.reservedAmount).toBe(18_000);
    expect(result.remainingAmount).toBe(72_000);
    expect(result.recommendedMonthlyAmount).toBe(8_000);
    expect(result.fundedFraction).toBe(0.2);
  });

  it("builds household totals and selects the nearest cost", () => {
    const result = calculateAnnualBudget(
      [
        {
          id: "insurance",
          name: "Försäkring",
          targetAmount: 120_000,
          dueMonth: "2027-01",
          entries: [{ amount: 60_000, entryType: "CONTRIBUTION" }],
        },
        {
          id: "service",
          name: "Service",
          targetAmount: 80_000,
          dueMonth: "2026-11",
          entries: [{ amount: 20_000, entryType: "CONTRIBUTION" }],
        },
      ],
      new Date(2026, 7, 1),
    );

    expect(result.totalTarget).toBe(200_000);
    expect(result.totalReserved).toBe(80_000);
    expect(result.nextItem?.name).toBe("Service");
  });
});
