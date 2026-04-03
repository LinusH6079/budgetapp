import { cache } from "react";
import { buildMonthSummary } from "@/lib/budget-calculations";
import { compareMonthKeys, getNextMonthKey, getPreviousMonthKey } from "@/lib/date";
import { db } from "@/lib/db";
import { budgetMonthDetailsArgs, BudgetMonthWithDetails } from "@/lib/types";
import { assertMonthEditable } from "@/server/services/access";
import { getHouseholdForUser, mapMembersToSlots } from "@/server/services/households";

type RecurringExpenseSource = {
  id: string;
  name: string;
  amount: number;
  category: string;
  expenseType: "RECURRING" | "ONE_TIME";
  planningType: "PLANNED" | "UNPLANNED";
  payerType: "FIRST_PERSON" | "SECOND_PERSON" | "SHARED";
  dueDate: Date | null;
  note: string | null;
};

function dueDateForMonth(sourceDate: Date | null, monthKey: string) {
  if (!sourceDate) {
    return null;
  }

  const [year, month] = monthKey.split("-").map(Number);
  const maxDay = new Date(year, month, 0).getDate();
  const originalDay = sourceDate.getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(originalDay, maxDay), 12));
}

export function buildRecurringExpenseCopyData(
  expense: RecurringExpenseSource,
  targetMonthId: string,
  targetMonthKey: string,
  updatedByUserId: string,
) {
  return {
    budgetMonthId: targetMonthId,
    recurringSourceExpenseId: expense.id,
    name: expense.name,
    amount: expense.amount,
    category: expense.category,
    expenseType: expense.expenseType,
    planningType: expense.planningType,
    payerType: expense.payerType,
    dueDate: dueDateForMonth(expense.dueDate, targetMonthKey),
    isPaid: false,
    paidAt: null,
    note: expense.note,
    updatedByUserId,
  };
}

export function buildRecurringExpenseCopies(
  month: Pick<BudgetMonthWithDetails, "expenses">,
  targetMonthId: string,
  targetMonthKey: string,
  updatedByUserId: string,
) {
  return month.expenses
    .filter((expense) => expense.expenseType === "RECURRING")
    .map((expense) =>
      buildRecurringExpenseCopyData(expense, targetMonthId, targetMonthKey, updatedByUserId),
    );
}

async function requireMonthAccessById(userId: string, monthId: string) {
  const month = await db.budgetMonth.findUnique({
    where: {
      id: monthId,
    },
    include: {
      household: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!month || !month.household.members.some((member) => member.userId === userId)) {
    throw new Error("Månaden hittades inte.");
  }

  return month;
}

export const getMonthsForUser = cache(async (userId: string) => {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    return [];
  }

  return db.budgetMonth.findMany({
    where: {
      householdId: household.id,
    },
    orderBy: {
      monthKey: "desc",
    },
    select: {
      id: true,
      monthKey: true,
      isLocked: true,
      updatedAt: true,
    },
  });
});

export const getMonthPageData = cache(async (userId: string, monthKey: string) => {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    return null;
  }

  const activeMonth = await db.budgetMonth.findUnique({
    where: {
      householdId_monthKey: {
        householdId: household.id,
        monthKey,
      },
    },
    ...budgetMonthDetailsArgs,
  });

  if (!activeMonth) {
    return null;
  }

  const [previousMonth, nextMonth, allMonths] = await Promise.all([
    db.budgetMonth.findUnique({
      where: {
        householdId_monthKey: {
          householdId: household.id,
          monthKey: getPreviousMonthKey(monthKey),
        },
      },
      include: {
        personSnapshots: true,
        expenses: true,
      },
    }),
    db.budgetMonth.findUnique({
      where: {
        householdId_monthKey: {
          householdId: household.id,
          monthKey: getNextMonthKey(monthKey),
        },
      },
      include: {
        personSnapshots: true,
      },
    }),
    getMonthsForUser(userId),
  ]);

  const orderedMembers = mapMembersToSlots(household).map((member) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
    slot: member.slot,
  }));

  const summary = buildMonthSummary({
    monthKey: activeMonth.monthKey,
    snapshots: activeMonth.personSnapshots,
    expenses: activeMonth.expenses,
    orderedMembers,
    nextMonthSnapshots: nextMonth?.personSnapshots,
  });

  const previousSummary = previousMonth
    ? buildMonthSummary({
        monthKey: previousMonth.monthKey,
        snapshots: previousMonth.personSnapshots,
        expenses: previousMonth.expenses,
        orderedMembers,
        nextMonthSnapshots: activeMonth.personSnapshots,
      })
    : null;

  return {
    household,
    activeMonth,
    allMonths,
    previousMonth,
    nextMonth,
    summary,
    previousSummary,
  };
});

export async function createMonthForUser(input: {
  userId: string;
  monthKey: string;
  copyRecurringFromMonthId?: string | null;
}) {
  const household = await getHouseholdForUser(input.userId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan skapa månader.");
  }

  const existing = await db.budgetMonth.findUnique({
    where: {
      householdId_monthKey: {
        householdId: household.id,
        monthKey: input.monthKey,
      },
    },
  });

  if (existing) {
    throw new Error("Den månaden finns redan.");
  }

  const sourceMonth = input.copyRecurringFromMonthId
    ? await db.budgetMonth.findUnique({
        where: {
          id: input.copyRecurringFromMonthId,
        },
        ...budgetMonthDetailsArgs,
      })
    : null;

  if (sourceMonth && sourceMonth.householdId !== household.id) {
    throw new Error("Källmånaden hör inte till ditt hushåll.");
  }

  return db.$transaction(async (tx) => {
    const month = await tx.budgetMonth.create({
      data: {
        householdId: household.id,
        monthKey: input.monthKey,
        updatedByUserId: input.userId,
      },
    });

    const snapshotData = household.members.map((member) => ({
      budgetMonthId: month.id,
      userId: member.userId,
      updatedByUserId: input.userId,
      incomeAmount: 0,
      carryOverAmount: 0,
    }));

    if (snapshotData.length > 0) {
      await tx.monthlyPersonSnapshot.createMany({
        data: snapshotData,
      });
    }

    if (sourceMonth) {
      const recurringExpenses = buildRecurringExpenseCopies(
        sourceMonth,
        month.id,
        input.monthKey,
        input.userId,
      );

      if (recurringExpenses.length > 0) {
        await tx.expense.createMany({
          data: recurringExpenses,
        });
      }
    }

    return month;
  });
}

export async function createNextMonthForUser(userId: string, currentMonthKey: string) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan skapa nästa månad.");
  }

  const currentMonth = await db.budgetMonth.findUnique({
    where: {
      householdId_monthKey: {
        householdId: household.id,
        monthKey: currentMonthKey,
      },
    },
  });

  if (!currentMonth) {
    throw new Error("Nuvarande månad hittades inte.");
  }

  return createMonthForUser({
    userId,
    monthKey: getNextMonthKey(currentMonthKey),
    copyRecurringFromMonthId: currentMonth.id,
  });
}

export async function updateSnapshotValuesForUser(input: {
  actorUserId: string;
  monthId: string;
  targetUserId: string;
  incomeAmount: number;
  carryOverAmount: number;
}) {
  const month = await requireMonthAccessById(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  if (!month.household.members.some((member) => member.userId === input.targetUserId)) {
    throw new Error("Användaren hör inte till hushållet.");
  }

  return db.monthlyPersonSnapshot.upsert({
    where: {
      budgetMonthId_userId: {
        budgetMonthId: input.monthId,
        userId: input.targetUserId,
      },
    },
    create: {
      budgetMonthId: input.monthId,
      userId: input.targetUserId,
      incomeAmount: input.incomeAmount,
      carryOverAmount: input.carryOverAmount,
      updatedByUserId: input.actorUserId,
    },
    update: {
      incomeAmount: input.incomeAmount,
      carryOverAmount: input.carryOverAmount,
      updatedByUserId: input.actorUserId,
    },
  });
}

export async function updateMonthNoteForUser(input: {
  actorUserId: string;
  monthId: string;
  note: string;
}) {
  const month = await requireMonthAccessById(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  return db.budgetMonth.update({
    where: {
      id: input.monthId,
    },
    data: {
      note: input.note,
      updatedByUserId: input.actorUserId,
    },
  });
}

export async function toggleMonthLockForUser(input: {
  actorUserId: string;
  monthId: string;
  nextLockedState: "lock" | "unlock";
}) {
  await requireMonthAccessById(input.actorUserId, input.monthId);

  return db.budgetMonth.update({
    where: {
      id: input.monthId,
    },
    data: {
      isLocked: input.nextLockedState === "lock",
      updatedByUserId: input.actorUserId,
    },
  });
}

export function getRedirectMonthKeyAfterDeletion(
  monthKeys: string[],
  deletedMonthKey: string,
) {
  const remainingMonthKeys = monthKeys
    .filter((monthKey) => monthKey !== deletedMonthKey)
    .sort(compareMonthKeys);

  const previousMonthKey = [...remainingMonthKeys]
    .reverse()
    .find((monthKey) => compareMonthKeys(monthKey, deletedMonthKey) < 0);

  if (previousMonthKey) {
    return previousMonthKey;
  }

  return remainingMonthKeys.find((monthKey) => compareMonthKeys(monthKey, deletedMonthKey) > 0) ?? null;
}

export async function deleteMonthForUser(input: {
  actorUserId: string;
  monthId: string;
}) {
  const month = await requireMonthAccessById(input.actorUserId, input.monthId);
  const householdMonthKeys = await db.budgetMonth.findMany({
    where: {
      householdId: month.householdId,
    },
    select: {
      monthKey: true,
    },
  });
  const redirectMonthKey = getRedirectMonthKeyAfterDeletion(
    householdMonthKeys.map((row) => row.monthKey),
    month.monthKey,
  );

  await db.budgetMonth.delete({
    where: {
      id: input.monthId,
    },
  });

  return {
    deletedMonthKey: month.monthKey,
    redirectMonthKey,
  };
}

export function sortExpenseItems<T extends { amount: number; name: string }>(
  expenses: T[],
  sort: string,
) {
  const sorted = [...expenses];

  if (sort === "amount") {
    sorted.sort((a, b) => b.amount - a.amount);
    return sorted;
  }

  if (sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    return sorted;
  }

  sorted.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  return sorted;
}

export function filterExpenseItems<
  T extends {
    isPaid: boolean;
    expenseType: string;
    category: string;
    payerType: string;
  },
>(
  expenses: T[],
  filters: {
    status?: string;
    type?: string;
    category?: string;
    payer?: string;
  },
) {
  return expenses.filter((expense) => {
    if (filters.status === "paid" && !expense.isPaid) {
      return false;
    }

    if (filters.status === "unpaid" && expense.isPaid) {
      return false;
    }

    if (filters.type && filters.type !== "all" && expense.expenseType !== filters.type) {
      return false;
    }

    if (filters.category && filters.category !== "all" && expense.category !== filters.category) {
      return false;
    }

    if (filters.payer && filters.payer !== "all" && expense.payerType !== filters.payer) {
      return false;
    }

    return true;
  });
}

export async function getLatestMonthKeyForUser(userId: string) {
  const months = await getMonthsForUser(userId);
  return months.sort((a, b) => compareMonthKeys(b.monthKey, a.monthKey))[0]?.monthKey ?? null;
}
