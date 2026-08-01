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
  savingStartMonth?: string | null;
  dueMonth: string;
  entries: AnnualBudgetEntryInput[];
  savingMode?: "TARGET_BY_DATE" | "CUSTOM_SCHEDULE";
  savingRates?: AnnualSavingRateInput[];
  excludedMonthKeys?: string[];
};

export type AnnualSavingRateInput = {
  startMonth: string;
  endMonth?: string | null;
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
    monthKey <= dueMonth;
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
    .filter(
      (rate) =>
        rate.startMonth <= monthKey &&
        (!rate.endMonth || rate.endMonth >= monthKey),
    )
    .sort((left, right) => right.startMonth.localeCompare(left.startMonth))[0]
    ?.monthlyAmount ?? 0;
}

export function buildGuaranteedAnnualSavingSchedule(input: {
  remainingAmount: number;
  monthKeys: string[];
  rates: AnnualSavingRateInput[];
}) {
  const fixedAmounts = new Map(
    input.monthKeys.map((monthKey) => [
      monthKey,
      effectiveAnnualSavingRate(input.rates, monthKey),
    ]),
  );
  const automaticMonthKeys = input.monthKeys.filter(
    (monthKey) => (fixedAmounts.get(monthKey) ?? 0) === 0,
  );
  const fixedTotal = input.monthKeys.reduce(
    (sum, monthKey) => sum + (fixedAmounts.get(monthKey) ?? 0),
    0,
  );
  const automaticAmounts = new Map(
    allocateAnnualSavingByMonth({
      remainingAmount: Math.max(0, input.remainingAmount - fixedTotal),
      monthKeys: automaticMonthKeys,
    }).map((allocation) => [allocation.monthKey, allocation.amount]),
  );

  if (
    automaticMonthKeys.length === 0 &&
    input.monthKeys.length > 0 &&
    fixedTotal < input.remainingAmount
  ) {
    const finalMonthKey = input.monthKeys.at(-1)!;
    fixedAmounts.set(
      finalMonthKey,
      (fixedAmounts.get(finalMonthKey) ?? 0) +
        input.remainingAmount -
        fixedTotal,
    );
  }

  const catchUpMonthKey =
    automaticMonthKeys.length === 0 &&
    input.monthKeys.length > 0 &&
    fixedTotal < input.remainingAmount
      ? input.monthKeys.at(-1)!
      : null;

  let amountLeft = Math.max(0, input.remainingAmount);
  const schedule = input.monthKeys.map((monthKey) => {
    const requestedAmount =
      fixedAmounts.get(monthKey) || automaticAmounts.get(monthKey) || 0;
    const amount = Math.min(requestedAmount, amountLeft);
    amountLeft = Math.max(0, amountLeft - amount);

    return {
      monthKey,
      amount,
      isCustomRate: (fixedAmounts.get(monthKey) ?? 0) > 0,
      isCatchUpAdjustment: monthKey === catchUpMonthKey,
    };
  });

  return {
    schedule,
    targetShortfall: amountLeft,
    isTargetSecured: amountLeft === 0,
  };
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

  return Math.max(1, difference + 1);
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
  const currentMonthKey = annualBudgetCurrentMonthKey(now);
  const savingStartMonth =
    item.savingStartMonth && item.savingStartMonth > currentMonthKey
      ? item.savingStartMonth
      : currentMonthKey;
  const targetMonthKeys = annualSavingMonthKeys(
    savingStartMonth,
    item.dueMonth,
  ).filter((monthKey) => !item.excludedMonthKeys?.includes(monthKey));
  const targetPlan =
    item.savingMode === "CUSTOM_SCHEDULE"
      ? buildGuaranteedAnnualSavingSchedule({
          remainingAmount,
          monthKeys: targetMonthKeys,
          rates: item.savingRates ?? [],
        })
      : {
          schedule: allocateAnnualSavingByMonth({
            remainingAmount,
            monthKeys: targetMonthKeys,
          }).map((month) => ({
            ...month,
            isCustomRate: false,
            isCatchUpAdjustment: false,
          })),
          targetShortfall: targetMonthKeys.length > 0 ? 0 : remainingAmount,
          isTargetSecured: remainingAmount === 0 || targetMonthKeys.length > 0,
        };
  const recommendedMonthlyAmount =
    targetPlan.schedule.find((month) => month.monthKey === currentMonthKey)
      ?.amount ??
    (item.savingMode === "CUSTOM_SCHEDULE" && currentMonthKey > item.dueMonth
      ? effectiveAnnualSavingRate(item.savingRates ?? [], currentMonthKey)
      : 0);
  const nextAutomaticAdjustment =
    item.savingMode === "CUSTOM_SCHEDULE"
      ? targetPlan.schedule.find(
          (month) =>
            month.monthKey > currentMonthKey &&
            !month.isCustomRate &&
            month.amount > 0,
        ) ?? null
      : null;
  const finalCatchUpAdjustment =
    item.savingMode === "CUSTOM_SCHEDULE"
      ? targetPlan.schedule.find((month) => month.isCatchUpAdjustment) ?? null
      : null;

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
    targetShortfall: targetPlan.targetShortfall,
    isTargetSecured: targetPlan.isTargetSecured,
    nextAutomaticAdjustment,
    finalCatchUpAdjustment,
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
