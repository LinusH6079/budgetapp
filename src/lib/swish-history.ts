import { expensePartAmount } from "@/lib/budget-calculations";

export type SwishHistoryExpense = {
  id: string;
  amount: number;
  payerType: "FIRST_PERSON" | "SECOND_PERSON" | "SHARED";
  swishId: string | null;
  firstPersonSwishId: string | null;
  secondPersonSwishId: string | null;
  paidAt: Date | null;
  updatedAt: Date;
  budgetMonth: {
    monthKey: string;
  };
};

export type SwishHistoryItem = {
  swishId: string;
  totalAmount: number;
  partCount: number;
  expenseCount: number;
  latestAt: Date;
  monthKeys: string[];
};

export function buildSwishHistory(
  expenses: SwishHistoryExpense[],
): SwishHistoryItem[] {
  const grouped = new Map<
    string,
    SwishHistoryItem & { expenseIds: Set<string>; months: Set<string> }
  >();

  function addReference(input: {
    expense: SwishHistoryExpense;
    swishId: string;
    amount: number;
    partCount: number;
  }) {
    const latestAt = input.expense.paidAt ?? input.expense.updatedAt;
    const current = grouped.get(input.swishId);

    if (current) {
      current.totalAmount += input.amount;
      current.partCount += input.partCount;
      current.expenseIds.add(input.expense.id);
      current.months.add(input.expense.budgetMonth.monthKey);
      if (latestAt > current.latestAt) current.latestAt = latestAt;
      return;
    }

    grouped.set(input.swishId, {
      swishId: input.swishId,
      totalAmount: input.amount,
      partCount: input.partCount,
      expenseCount: 1,
      latestAt,
      monthKeys: [],
      expenseIds: new Set([input.expense.id]),
      months: new Set([input.expense.budgetMonth.monthKey]),
    });
  }

  for (const expense of expenses) {
    if (expense.swishId) {
      const coversBothSharedParts =
        expense.payerType === "SHARED" &&
        expense.firstPersonSwishId === expense.swishId &&
        expense.secondPersonSwishId === expense.swishId;

      addReference({
        expense,
        swishId: expense.swishId,
        amount: expense.amount,
        partCount: coversBothSharedParts ? 2 : 1,
      });
      continue;
    }

    if (expense.firstPersonSwishId) {
      addReference({
        expense,
        swishId: expense.firstPersonSwishId,
        amount: expensePartAmount(expense.amount, "FIRST_PERSON"),
        partCount: 1,
      });
    }

    if (expense.secondPersonSwishId) {
      addReference({
        expense,
        swishId: expense.secondPersonSwishId,
        amount: expensePartAmount(expense.amount, "SECOND_PERSON"),
        partCount: 1,
      });
    }
  }

  return Array.from(grouped.values())
    .map(({ expenseIds, months, ...item }) => ({
      ...item,
      expenseCount: expenseIds.size,
      monthKeys: Array.from(months).sort().reverse(),
    }))
    .sort(
      (first, second) =>
        second.latestAt.getTime() - first.latestAt.getTime() ||
        first.swishId.localeCompare(second.swishId, "sv"),
    );
}
