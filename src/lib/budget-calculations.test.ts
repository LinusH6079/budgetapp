import { describe, expect, it } from "vitest";

import { buildMonthSummary } from "@/lib/budget-calculations";

describe("budget calculations", () => {
  const orderedMembers = [
    {
      userId: "u1",
      name: "Linus",
      email: "linus@example.com",
      slot: "FIRST_PERSON" as const,
    },
    {
      userId: "u2",
      name: "Alex",
      email: "alex@example.com",
      slot: "SECOND_PERSON" as const,
    },
  ];

  it("räknar totalsummor och hushållets oförklarade förbrukning", () => {
    const summary = buildMonthSummary({
      monthKey: "2026-04",
      orderedMembers,
      snapshots: [
        { userId: "u1", incomeAmount: 300000, carryOverAmount: 20000 },
        { userId: "u2", incomeAmount: 250000, carryOverAmount: 10000 },
      ],
      expenses: [
        {
          id: "e1",
          amount: 100000,
          category: "Boende",
          planningType: "PLANNED",
          payerType: "SHARED",
          isPaid: true,
          dueDate: new Date("2026-04-01"),
        },
        {
          id: "e2",
          amount: 5000,
          category: "Mat",
          planningType: "UNPLANNED",
          payerType: "FIRST_PERSON",
          isPaid: true,
          dueDate: new Date("2026-04-03"),
        },
      ],
      nextMonthSnapshots: [
        { userId: "u1", incomeAmount: 0, carryOverAmount: 15000 },
        { userId: "u2", incomeAmount: 0, carryOverAmount: 12000 },
      ],
    });

    expect(summary.totalIncome).toBe(550000);
    expect(summary.totalCarryOver).toBe(30000);
    expect(summary.totalAvailable).toBe(580000);
    expect(summary.totalPlannedExpenses).toBe(100000);
    expect(summary.totalUnplannedExpenses).toBe(5000);
    expect(summary.totalExpenses).toBe(105000);
    expect(summary.totalPaidExpenses).toBe(105000);
    expect(summary.remainingActual).toBe(475000);
    expect(summary.unexplainedDifferenceFromPreviousMonth).toBe(448000);
  });

  it("delar gemensamma utgifter 50/50 i personsummeringen", () => {
    const summary = buildMonthSummary({
      monthKey: "2026-04",
      orderedMembers,
      snapshots: [
        { userId: "u1", incomeAmount: 100000, carryOverAmount: 0 },
        { userId: "u2", incomeAmount: 100000, carryOverAmount: 0 },
      ],
      expenses: [
        {
          id: "e1",
          amount: 30000,
          category: "Boende",
          planningType: "PLANNED",
          payerType: "SHARED",
          isPaid: true,
          dueDate: new Date("2026-04-01"),
        },
      ],
    });

    expect(summary.perPerson[0]?.paidExpenses).toBe(15000);
    expect(summary.perPerson[1]?.paidExpenses).toBe(15000);
    expect(summary.perPerson[0]?.totalExpenses).toBe(15000);
    expect(summary.perPerson[1]?.totalExpenses).toBe(15000);
  });

  it("räknar en gemensam utgift delvis betald per person", () => {
    const summary = buildMonthSummary({
      monthKey: "2026-04",
      orderedMembers,
      snapshots: [
        { userId: "u1", incomeAmount: 100000, carryOverAmount: 0 },
        { userId: "u2", incomeAmount: 100000, carryOverAmount: 0 },
      ],
      expenses: [
        {
          id: "e1",
          amount: 30001,
          category: "Boende",
          planningType: "PLANNED",
          payerType: "SHARED",
          isPaid: false,
          firstPersonPaidAt: new Date("2026-04-01"),
          secondPersonPaidAt: null,
          dueDate: null,
        },
      ],
    });

    expect(summary.totalExpenses).toBe(30001);
    expect(summary.totalPaidExpenses).toBe(15000);
    expect(summary.totalUnpaidExpenses).toBe(15001);
    expect(summary.perPerson[0]?.paidExpenses).toBe(15000);
    expect(summary.perPerson[1]?.paidExpenses).toBe(0);
  });
});
