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
  savingMode?: "TARGET_BY_DATE" | "CUSTOM_SCHEDULE";
  savingRates?: AnnualSavingRateInput[];
};

export type AnnualSavingRateInput = {
  startMonth: string;
  monthlyAmount: number;
};

export function expenseAnnualContributionAmount(input: {
  amount: number;
  isPaid: boolean;
  hasActiveAnnualBudgetItem: boolean;
}) {
  return input.isPaid && input.hasActiveAnnualBudgetItem ? input.amount : 0;
}

export function annualBudgetCurrentMonthKey(now: Date) {
  const date = getStockholmCalendarDate(now);
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

function nextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function annualSavingMonthKeys(
  startMonthKey: string,
  dueMonth: string,
) {
  const monthKeys: string[] = [];

  for (
    let monthKey = startMonthKey;
    monthKey < dueMonth;
    monthKey = nextMonthKey(monthKey)
  ) {
    monthKeys.push(monthKey);
  }

  return monthKeys;
}

export function allocateAnnualSavingByMonth(input: {
  remainingAmount: number;
  monthKeys: string[];
}) {
  let remainingAmount = Math.max(0, input.remainingAmount);

  return input.monthKeys.map((monthKey, index) => {
    const monthsLeft = input.monthKeys.length - index;
    const amount = monthsLeft > 0
      ? Math.ceil(remainingAmount / monthsLeft)
      : 0;
    remainingAmount = Math.max(0, remainingAmount - amount);

    return {
      monthKey,
      amount,
    };
  });
}

export function effectiveAnnualSavingRate(
  rates: AnnualSavingRateInput[],
  monthKey: string,
) {
  return [...rates]
    .filter((rate) => rate.startMonth <= monthKey)
    .sort((left, right) => right.startMonth.localeCompare(left.startMonth))[0]
    ?.monthlyAmount ?? 0;
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
  const [year, month] = annualBudgetCurrentMonthKey(now).split("-").map(Number);
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
  const recommendedMonthlyAmount =
    item.savingMode === "CUSTOM_SCHEDULE"
      ? effectiveAnnualSavingRate(
          item.savingRates ?? [],
          annualBudgetCurrentMonthKey(now),
        )
      : Math.ceil(remainingAmount / monthsUntilDue(item.dueMonth, now));

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
