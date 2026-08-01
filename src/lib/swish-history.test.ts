import { describe, expect, it } from "vitest";

import { buildSwishHistory, type SwishHistoryExpense } from "@/lib/swish-history";

function expense(
  overrides: Partial<SwishHistoryExpense> & Pick<SwishHistoryExpense, "id" | "amount">,
): SwishHistoryExpense {
  return {
    payerType: "FIRST_PERSON",
    swishId: null,
    firstPersonSwishId: null,
    secondPersonSwishId: null,
    paidAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    budgetMonth: { monthKey: "2026-08" },
    ...overrides,
  };
}

describe("Swish history", () => {
  it("groups whole expenses by Swish ID", () => {
    const history = buildSwishHistory([
      expense({ id: "one", amount: 4_000, swishId: "SWISH-1" }),
      expense({ id: "two", amount: 6_000, swishId: "SWISH-1" }),
    ]);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      swishId: "SWISH-1",
      totalAmount: 10_000,
      partCount: 2,
      expenseCount: 2,
    });
  });

  it("counts shared halves separately without double counting", () => {
    const history = buildSwishHistory([
      expense({
        id: "shared",
        amount: 10_001,
        payerType: "SHARED",
        firstPersonSwishId: "FIRST-SWISH",
        secondPersonSwishId: "SECOND-SWISH",
      }),
    ]);

    expect(history.map(({ swishId, totalAmount }) => ({ swishId, totalAmount }))).toEqual([
      { swishId: "FIRST-SWISH", totalAmount: 5_000 },
      { swishId: "SECOND-SWISH", totalAmount: 5_001 },
    ]);
  });

  it("shows a shared expense paid in one Swish as one total with two parts", () => {
    const history = buildSwishHistory([
      expense({
        id: "shared",
        amount: 12_000,
        payerType: "SHARED",
        swishId: "BOTH-SWISH",
        firstPersonSwishId: "BOTH-SWISH",
        secondPersonSwishId: "BOTH-SWISH",
      }),
    ]);

    expect(history[0]).toMatchObject({
      swishId: "BOTH-SWISH",
      totalAmount: 12_000,
      partCount: 2,
      expenseCount: 1,
    });
  });
});
