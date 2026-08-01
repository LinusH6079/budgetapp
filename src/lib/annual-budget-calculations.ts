import { getStockholmCalendarDate } from "@/lib/pay-cycle";

export type AnnualBudgetEntryInput = {
  amount: number;
  entryType: "CONTRIBUTION" | "WITHDRAWAL";
  sourceExpenseId?: string | null;
};

export type AnnualBudgetItemInput = {
  id: string;
  name: string;
  targetAmount: number;
  dueMonth: string;
  entries: AnnualBudgetEntryInput[];
};

export function expenseAnnualContributionAmount(input: {
  amount: number;
  isPaid: boolean;
  hasActiveAnnualBudgetItem: boolean;
}) {
  return input.isPaid && input.hasActiveAnnualBudgetItem ? input.amount : 0;
}

function currentMonthKey(now: Date) {
  const date = getStockholmCalendarDate(now);
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

export function netReservedAmount(entries: AnnualBudgetEntryInput[]) {
  return Math.max(
    0,
    entries.reduce(
      (sum, entry) =>
        sum +
        (entry.entryType === "CONTRIBUTION" ? entry.amount : -entry.amount),
      0,
    ),
  );
}

export function monthsUntilDue(dueMonth: string, now = new Date()) {
  const [dueYear, dueMonthNumber] = dueMonth.split("-").map(Number);
  const [year, month] = currentMonthKey(now).split("-").map(Number);
  const difference =
    (dueYear - year) * 12 + (dueMonthNumber - month);

  return Math.max(1, difference);
}

export function calculateAnnualBudgetItem(
  item: AnnualBudgetItemInput,
  now = new Date(),
) {
  const reservedAmount = netReservedAmount(item.entries);
  const reservedViaExpenses = item.entries.reduce(
    (sum, entry) =>
      sum +
      (entry.entryType === "CONTRIBUTION" && entry.sourceExpenseId
        ? entry.amount
        : 0),
    0,
  );
  const remainingAmount = Math.max(0, item.targetAmount - reservedAmount);
  const recommendedMonthlyAmount = Math.ceil(
    remainingAmount / monthsUntilDue(item.dueMonth, now),
  );

  return {
    ...item,
    reservedAmount,
    reservedViaExpenses,
    reservedOutsideMonthlyBudget: Math.max(
      0,
      reservedAmount - reservedViaExpenses,
    ),
    remainingAmount,
    recommendedMonthlyAmount,
    fundedFraction:
      item.targetAmount > 0
        ? Math.min(1, reservedAmount / item.targetAmount)
        : 1,
  };
}

export function calculateAnnualBudget(
  items: AnnualBudgetItemInput[],
  now = new Date(),
) {
  const calculatedItems = items
    .map((item) => calculateAnnualBudgetItem(item, now))
    .sort((left, right) => left.dueMonth.localeCompare(right.dueMonth));

  return {
    items: calculatedItems,
    totalTarget: calculatedItems.reduce(
      (sum, item) => sum + item.targetAmount,
      0,
    ),
    totalReserved: calculatedItems.reduce(
      (sum, item) => sum + item.reservedAmount,
      0,
    ),
    reservedOutsideMonthlyBudget: calculatedItems.reduce(
      (sum, item) => sum + item.reservedOutsideMonthlyBudget,
      0,
    ),
    recommendedThisMonth: calculatedItems.reduce(
      (sum, item) => sum + item.recommendedMonthlyAmount,
      0,
    ),
    nextItem: calculatedItems[0] ?? null,
  };
}
