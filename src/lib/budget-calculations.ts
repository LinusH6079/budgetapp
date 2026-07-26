import { PayerType, PlanningType } from "@prisma/client";

export type BudgetExpenseLike = {
  id: string;
  amount: number;
  category: string;
  planningType: PlanningType;
  payerType: PayerType;
  isPaid: boolean;
  firstPersonPaidAt?: Date | null;
  secondPersonPaidAt?: Date | null;
  dueDate: Date | null;
};

export type BudgetPersonSnapshotLike = {
  userId: string;
  incomeAmount: number;
  carryOverAmount: number;
};

export type PersonSlot = "FIRST_PERSON" | "SECOND_PERSON";

export function expensePartAmount(
  amount: number,
  payerType?: PersonSlot,
) {
  if (!payerType) {
    return amount;
  }

  const firstHalf = Math.floor(amount / 2);
  return payerType === "FIRST_PERSON" ? firstHalf : amount - firstHalf;
}

export type OrderedMember = {
  userId: string;
  name: string;
  email: string;
  slot: PersonSlot;
};

export type BudgetComputationInput = {
  monthKey: string;
  snapshots: BudgetPersonSnapshotLike[];
  expenses: BudgetExpenseLike[];
  orderedMembers: OrderedMember[];
  nextMonthSnapshots?: BudgetPersonSnapshotLike[];
  now?: Date;
};

export type PersonSummary = {
  userId: string;
  slot: PersonSlot;
  name: string;
  income: number;
  carryOver: number;
  plannedExpenses: number;
  totalExpenses: number;
  paidExpenses: number;
  remainingPlanned: number;
  remainingActual: number;
  unexplainedDifferenceFromPreviousMonth?: number | null;
};

function amountForPerson(payerType: PayerType, amount: number, slot: PersonSlot) {
  if (payerType === PayerType.SHARED) {
    if (slot === "FIRST_PERSON") {
      return Math.floor(amount / 2);
    }

    return amount - Math.floor(amount / 2);
  }

  if (payerType === PayerType.FIRST_PERSON) {
    return slot === "FIRST_PERSON" ? amount : 0;
  }

  return slot === "SECOND_PERSON" ? amount : 0;
}

function isPaidForPerson(expense: BudgetExpenseLike, slot: PersonSlot) {
  if (expense.payerType === PayerType.SHARED) {
    if (expense.isPaid && !expense.firstPersonPaidAt && !expense.secondPersonPaidAt) {
      return true;
    }

    return slot === "FIRST_PERSON"
      ? expense.firstPersonPaidAt !== null && expense.firstPersonPaidAt !== undefined
      : expense.secondPersonPaidAt !== null && expense.secondPersonPaidAt !== undefined;
  }

  return expense.isPaid;
}

function paidAmount(expense: BudgetExpenseLike) {
  if (expense.payerType !== PayerType.SHARED) {
    return expense.isPaid ? expense.amount : 0;
  }

  return (["FIRST_PERSON", "SECOND_PERSON"] as const).reduce(
    (sum, slot) =>
      isPaidForPerson(expense, slot)
        ? sum + amountForPerson(expense.payerType, expense.amount, slot)
        : sum,
    0,
  );
}

export function totalIncome(input: BudgetComputationInput) {
  return input.snapshots.reduce((sum, row) => sum + row.incomeAmount, 0);
}

export function totalCarryOver(input: BudgetComputationInput) {
  return input.snapshots.reduce((sum, row) => sum + row.carryOverAmount, 0);
}

export function totalAvailable(input: BudgetComputationInput) {
  return totalIncome(input) + totalCarryOver(input);
}

export function plannedExpensesTotal(input: BudgetComputationInput) {
  return input.expenses.reduce((sum, expense) => {
    return expense.planningType === PlanningType.PLANNED ? sum + expense.amount : sum;
  }, 0);
}

export function unplannedExpensesTotal(input: BudgetComputationInput) {
  return input.expenses.reduce((sum, expense) => {
    return expense.planningType === PlanningType.UNPLANNED ? sum + expense.amount : sum;
  }, 0);
}

export function paidExpensesTotal(input: BudgetComputationInput) {
  return input.expenses.reduce((sum, expense) => sum + paidAmount(expense), 0);
}

export function unpaidExpensesTotal(input: BudgetComputationInput) {
  return input.expenses.reduce((sum, expense) => sum + expense.amount - paidAmount(expense), 0);
}

export function expensesTotal(input: BudgetComputationInput) {
  return input.expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function remainingPlanned(input: BudgetComputationInput) {
  return totalAvailable(input) - plannedExpensesTotal(input);
}

export function remainingActual(input: BudgetComputationInput) {
  return totalAvailable(input) - paidExpensesTotal(input);
}

export function overdueExpensesCount(input: BudgetComputationInput) {
  const now = input.now ?? new Date();

  return input.expenses.filter((expense) => {
    return !expense.isPaid && expense.dueDate !== null && expense.dueDate < now;
  }).length;
}

export function unexplainedDifferenceFromPreviousMonth(input: BudgetComputationInput) {
  if (!input.nextMonthSnapshots || input.nextMonthSnapshots.length === 0) {
    return null;
  }

  const nextCarryOver = input.nextMonthSnapshots.reduce(
    (sum, row) => sum + row.carryOverAmount,
    0,
  );

  return remainingActual(input) - nextCarryOver;
}

export function perPersonTotals(input: BudgetComputationInput): PersonSummary[] {
  return input.orderedMembers.map((member) => {
    const snapshot = input.snapshots.find((row) => row.userId === member.userId);
    const nextSnapshot = input.nextMonthSnapshots?.find((row) => row.userId === member.userId);
    const income = snapshot?.incomeAmount ?? 0;
    const carryOver = snapshot?.carryOverAmount ?? 0;
    const plannedExpenses = input.expenses.reduce((sum, expense) => {
      if (expense.planningType !== PlanningType.PLANNED) {
        return sum;
      }

      return sum + amountForPerson(expense.payerType, expense.amount, member.slot);
    }, 0);
    const totalExpenses = input.expenses.reduce(
      (sum, expense) => sum + amountForPerson(expense.payerType, expense.amount, member.slot),
      0,
    );
    const paidExpenses = input.expenses.reduce((sum, expense) => {
      if (!isPaidForPerson(expense, member.slot)) {
        return sum;
      }

      return sum + amountForPerson(expense.payerType, expense.amount, member.slot);
    }, 0);
    const available = income + carryOver;
    const nextCarry = nextSnapshot?.carryOverAmount ?? null;

    return {
      userId: member.userId,
      slot: member.slot,
      name: member.name,
      income,
      carryOver,
      plannedExpenses,
      totalExpenses,
      paidExpenses,
      remainingPlanned: available - plannedExpenses,
      remainingActual: available - paidExpenses,
      unexplainedDifferenceFromPreviousMonth:
        nextCarry === null ? null : available - paidExpenses - nextCarry,
    };
  });
}

export function categoryTotals(input: BudgetComputationInput) {
  return Object.entries(
    input.expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {}),
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildMonthSummary(input: BudgetComputationInput) {
  return {
    totalIncome: totalIncome(input),
    totalCarryOver: totalCarryOver(input),
    totalAvailable: totalAvailable(input),
    totalPlannedExpenses: plannedExpensesTotal(input),
    totalUnplannedExpenses: unplannedExpensesTotal(input),
    totalExpenses: expensesTotal(input),
    totalPaidExpenses: paidExpensesTotal(input),
    totalUnpaidExpenses: unpaidExpensesTotal(input),
    remainingPlanned: remainingPlanned(input),
    remainingActual: remainingActual(input),
    overdueExpensesCount: overdueExpensesCount(input),
    unexplainedDifferenceFromPreviousMonth: unexplainedDifferenceFromPreviousMonth(input),
    perPerson: perPersonTotals(input),
    categories: categoryTotals(input),
    unpaidCount: input.expenses.filter((expense) => !expense.isPaid).length,
  };
}
