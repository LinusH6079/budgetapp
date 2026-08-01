import { describe, expect, it } from "vitest";

import {
  allocateAnnualSavingByMonth,
  annualSavingMonthKeys,
  calculateAnnualBudget,
  calculateAnnualBudgetItem,
  expenseAnnualContributionAmount,
  effectiveAnnualSavingRate,
  netReservedAmount,
} from "@/lib/annual-budget-calculations";

describe("annual budget calculations", () => {
  it("counts a tagged expense only after it is paid", () => {
    expect(
      expenseAnnualContributionAmount({
        amount: 25_000,
        isPaid: false,
        hasActiveAnnualBudgetItem: true,
      }),
    ).toBe(0);
    expect(
      expenseAnnualContributionAmount({
        amount: 25_000,
        isPaid: true,
        hasActiveAnnualBudgetItem: true,
      }),
    ).toBe(25_000);
  });

  it("does not count an expense when its annual target is unavailable", () => {
    expect(
      expenseAnnualContributionAmount({
        amount: 25_000,
        isPaid: true,
        hasActiveAnnualBudgetItem: false,
      }),
    ).toBe(0);
  });

  it("separates transfers already counted as monthly expenses", () => {
    const result = calculateAnnualBudget(
      [
        {
          id: "car-tax",
          name: "Bilskatt",
          targetAmount: 120_000,
          dueMonth: "2027-01",
          entries: [
            {
              amount: 20_000,
              entryType: "CONTRIBUTION",
              sourceExpenseId: "expense-1",
            },
            {
              amount: 10_000,
              entryType: "CONTRIBUTION",
              sourceExpenseId: null,
            },
          ],
        },
      ],
      new Date(2026, 7, 1),
    );

    expect(result.totalReserved).toBe(30_000);
    expect(result.reservedOutsideMonthlyBudget).toBe(10_000);
  });

  it("calculates net reserved money from contributions and withdrawals", () => {
    expect(
      netReservedAmount([
        { amount: 5_000, entryType: "CONTRIBUTION" },
        { amount: 1_500, entryType: "WITHDRAWAL" },
      ]),
    ).toBe(3_500);
  });

  it("uses the current month through the month before the money is needed", () => {
    const result = calculateAnnualBudgetItem(
      {
        id: "october-cost",
        name: "Oktoberkostnad",
        targetAmount: 120_000,
        dueMonth: "2026-10",
        entries: [],
      },
      new Date(2026, 7, 1),
    );

    expect(result.recommendedMonthlyAmount).toBe(60_000);
  });

  it("builds an exact automatic saving schedule before the due month", () => {
    const monthKeys = annualSavingMonthKeys("2026-08", "2026-11");
    const schedule = allocateAnnualSavingByMonth({
      remainingAmount: 10_000,
      monthKeys,
    });

    expect(monthKeys).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(schedule).toEqual([
      { monthKey: "2026-08", amount: 3_334 },
      { monthKey: "2026-09", amount: 3_333 },
      { monthKey: "2026-10", amount: 3_333 },
    ]);
    expect(schedule.reduce((sum, month) => sum + month.amount, 0)).toBe(10_000);
  });

  it("uses the latest step in a custom saving schedule", () => {
    const rates = [
      { startMonth: "2026-08", monthlyAmount: 300_000 },
      { startMonth: "2027-04", monthlyAmount: 600_000 },
    ];

    expect(effectiveAnnualSavingRate(rates, "2027-03")).toBe(300_000);
    expect(effectiveAnnualSavingRate(rates, "2027-04")).toBe(600_000);
  });

  it("continues a custom saving schedule after its milestone and target", () => {
    const result = calculateAnnualBudgetItem(
      {
        id: "deposit",
        name: "Kontantinsats",
        targetAmount: 500_000,
        dueMonth: "2027-03",
        savingMode: "CUSTOM_SCHEDULE",
        savingRates: [
          { startMonth: "2026-08", monthlyAmount: 30_000 },
          { startMonth: "2027-04", monthlyAmount: 60_000 },
        ],
        entries: [{ amount: 600_000, entryType: "CONTRIBUTION" }],
      },
      new Date(2027, 4, 1),
    );

    expect(result.remainingAmount).toBe(0);
    expect(result.recommendedMonthlyAmount).toBe(60_000);
  });

  it("recommends an even monthly amount before the due month", () => {
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
    expect(result.recommendedMonthlyAmount).toBe(9_000);
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
