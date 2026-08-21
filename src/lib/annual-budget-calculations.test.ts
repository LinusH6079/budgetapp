import { describe, expect, it } from "vitest";

import {
  allocateAnnualSavingByMonth,
  annualSavingMonthKeys,
  calculateAnnualBudget,
  calculateAnnualBudgetItem,
  buildGuaranteedAnnualSavingSchedule,
  expenseAnnualContributionAmount,
  effectiveAnnualSavingRate,
  futureYearlySavingCycles,
  netReservedAmount,
  nextYearlySavingStartMonth,
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

  it("counts each paid share of a shared annual saving separately", () => {
    const base = {
      amount: 10_001,
      isPaid: false,
      hasActiveAnnualBudgetItem: true,
      payerType: "SHARED" as const,
      firstPersonSharePercent: 35,
    };
    const firstPaidAt = new Date("2026-09-01T12:00:00Z");
    const secondPaidAt = new Date("2026-09-02T12:00:00Z");

    expect(
      expenseAnnualContributionAmount({
        ...base,
        firstPersonPaidAt: firstPaidAt,
        secondPersonPaidAt: null,
      }),
    ).toBe(3_500);
    expect(
      expenseAnnualContributionAmount({
        ...base,
        firstPersonPaidAt: null,
        secondPersonPaidAt: secondPaidAt,
      }),
    ).toBe(6_501);
    expect(
      expenseAnnualContributionAmount({
        ...base,
        isPaid: true,
        firstPersonPaidAt: firstPaidAt,
        secondPersonPaidAt: secondPaidAt,
      }),
    ).toBe(10_001);
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

  it("includes both the selected first and last saving month", () => {
    const result = calculateAnnualBudgetItem(
      {
        id: "october-cost",
        name: "Oktoberkostnad",
        targetAmount: 120_000,
        savingStartMonth: "2026-08",
        dueMonth: "2026-10",
        entries: [],
      },
      new Date(2026, 7, 1),
    );

    expect(result.recommendedMonthlyAmount).toBe(40_000);
  });

  it("starts the next yearly saving cycle immediately after the prior due month", () => {
    expect(
      nextYearlySavingStartMonth({
        currentDueMonth: "2026-10",
        nextDueMonth: "2027-10",
        singleMonthOnly: false,
      }),
    ).toBe("2026-11");
    expect(
      nextYearlySavingStartMonth({
        currentDueMonth: "2026-12",
        nextDueMonth: "2027-12",
        singleMonthOnly: false,
      }),
    ).toBe("2027-01");
  });

  it("plans the next yearly cycle before the current cycle is settled", () => {
    expect(
      futureYearlySavingCycles({
        currentDueMonth: "2026-10",
        singleMonthOnly: false,
        throughMonth: "2026-11",
      }),
    ).toEqual([
      {
        savingStartMonth: "2026-11",
        dueMonth: "2027-10",
      },
    ]);
  });

  it("does not start a single-month yearly cost before its next due month", () => {
    expect(
      futureYearlySavingCycles({
        currentDueMonth: "2026-10",
        singleMonthOnly: true,
        throughMonth: "2026-11",
      }),
    ).toEqual([]);
  });

  it("keeps a yearly single-month cost in its due month", () => {
    expect(
      nextYearlySavingStartMonth({
        currentDueMonth: "2026-05",
        nextDueMonth: "2027-05",
        singleMonthOnly: true,
      }),
    ).toBe("2027-05");
  });

  it("reallocates future recommendations around a monthly override", () => {
    const august = calculateAnnualBudgetItem(
      {
        id: "car-tax",
        name: "Bilskatt",
        targetAmount: 120_000,
        savingStartMonth: "2026-08",
        dueMonth: "2026-10",
        entries: [],
        monthlyOverrides: [{ monthKey: "2026-09", amount: 20_000 }],
      },
      new Date(2026, 7, 1),
    );
    const september = calculateAnnualBudgetItem(
      {
        id: "car-tax",
        name: "Bilskatt",
        targetAmount: 120_000,
        savingStartMonth: "2026-08",
        dueMonth: "2026-10",
        entries: [],
        monthlyOverrides: [{ monthKey: "2026-09", amount: 20_000 }],
      },
      new Date(2026, 8, 1),
    );

    expect(august.recommendedMonthlyAmount).toBe(50_000);
    expect(september.recommendedMonthlyAmount).toBe(20_000);
    expect(september.isTargetSecured).toBe(true);
  });

  it("waits until the selected first saving month", () => {
    const result = calculateAnnualBudgetItem(
      {
        id: "future-start",
        name: "Framtida sparstart",
        targetAmount: 120_000,
        savingStartMonth: "2026-09",
        dueMonth: "2026-10",
        entries: [],
      },
      new Date(2026, 7, 1),
    );

    expect(result.recommendedMonthlyAmount).toBe(0);
  });

  it("builds an exact automatic saving schedule including the last month", () => {
    const monthKeys = annualSavingMonthKeys("2026-08", "2026-11");
    const schedule = allocateAnnualSavingByMonth({
      remainingAmount: 10_000,
      monthKeys,
    });

    expect(monthKeys).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(schedule).toEqual([
      { monthKey: "2026-08", amount: 2_500 },
      { monthKey: "2026-09", amount: 2_500 },
      { monthKey: "2026-10", amount: 2_500 },
      { monthKey: "2026-11", amount: 2_500 },
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

  it("recalculates the automatic rate after a temporary lower period", () => {
    const result = buildGuaranteedAnnualSavingSchedule({
      remainingAmount: 120_000,
      monthKeys: ["2026-08", "2026-09", "2026-10", "2026-11"],
      rates: [
        {
          startMonth: "2026-08",
          endMonth: "2026-09",
          monthlyAmount: 10_000,
        },
      ],
    });

    expect(result.schedule).toEqual([
      {
        monthKey: "2026-08",
        amount: 10_000,
        isCustomRate: true,
        isCatchUpAdjustment: false,
      },
      {
        monthKey: "2026-09",
        amount: 10_000,
        isCustomRate: true,
        isCatchUpAdjustment: false,
      },
      {
        monthKey: "2026-10",
        amount: 50_000,
        isCustomRate: false,
        isCatchUpAdjustment: false,
      },
      {
        monthKey: "2026-11",
        amount: 50_000,
        isCustomRate: false,
        isCatchUpAdjustment: false,
      },
    ]);
    expect(result.isTargetSecured).toBe(true);
    expect(result.targetShortfall).toBe(0);
  });

  it("adds a final catch-up when every target month has a custom amount", () => {
    const result = buildGuaranteedAnnualSavingSchedule({
      remainingAmount: 100_000,
      monthKeys: ["2026-08", "2026-09"],
      rates: [
        {
          startMonth: "2026-08",
          endMonth: "2026-09",
          monthlyAmount: 20_000,
        },
      ],
    });

    expect(result.schedule.map((month) => month.amount)).toEqual([
      20_000,
      80_000,
    ]);
    expect(result.isTargetSecured).toBe(true);
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

  it("shows a shortfall when every remaining target month is overridden", () => {
    const result = calculateAnnualBudgetItem(
      {
        id: "deposit",
        name: "Kontantinsats",
        targetAmount: 100_000,
        dueMonth: "2026-10",
        savingMode: "CUSTOM_SCHEDULE",
        savingRates: [],
        excludedMonthKeys: ["2026-08", "2026-09", "2026-10"],
        entries: [],
      },
      new Date(2026, 7, 1),
    );

    expect(result.isTargetSecured).toBe(false);
    expect(result.targetShortfall).toBe(100_000);
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
