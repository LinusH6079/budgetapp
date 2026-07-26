import { Prisma, PayerType, PlanningType } from "@prisma/client";

import { db } from "@/lib/db";
import { getNextMonthKey } from "@/lib/date";
import { assertMonthEditable } from "@/server/services/access";
import { buildRecurringExpenseCopyData } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";

async function requireExpenseAccess(actorUserId: string, monthId: string) {
  const month = await db.budgetMonth.findUnique({
    where: {
      id: monthId,
    },
    include: {
      household: {
        include: {
          members: {
            orderBy: {
              joinedAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!month || !month.household.members.some((member) => member.userId === actorUserId)) {
    throw new Error("Månaden hittades inte.");
  }

  return month;
}

async function requireExpenseInMonth(expenseId: string, monthId: string) {
  const expense = await db.expense.findFirst({
    where: {
      id: expenseId,
      budgetMonthId: monthId,
    },
  });

  if (!expense) {
    throw new Error("Utgiften hittades inte.");
  }

  return expense;
}

async function syncRecurringExpenseToNextMonth(input: {
  tx: Prisma.TransactionClient;
  actorUserId: string;
  sourceMonth: Awaited<ReturnType<typeof requireExpenseAccess>>;
  sourceExpense: {
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
}) {
  const nextMonth = await input.tx.budgetMonth.findUnique({
    where: {
      householdId_monthKey: {
        householdId: input.sourceMonth.householdId,
        monthKey: getNextMonthKey(input.sourceMonth.monthKey),
      },
    },
    select: {
      id: true,
      isLocked: true,
      monthKey: true,
    },
  });

  if (!nextMonth || nextMonth.isLocked) {
    return;
  }

  if (input.sourceExpense.expenseType !== "RECURRING") {
    await input.tx.expense.deleteMany({
      where: {
        budgetMonthId: nextMonth.id,
        recurringSourceExpenseId: input.sourceExpense.id,
      },
    });

    return;
  }

  const recurringCopy = buildRecurringExpenseCopyData(
    input.sourceExpense,
    nextMonth.id,
    nextMonth.monthKey,
    input.actorUserId,
  );

  await input.tx.expense.upsert({
    where: {
      budgetMonthId_recurringSourceExpenseId: {
        budgetMonthId: nextMonth.id,
        recurringSourceExpenseId: input.sourceExpense.id,
      },
    },
    create: recurringCopy,
    update: recurringCopy,
  });
}

export async function upsertExpenseForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseId?: string | null;
  name: string;
  amount: number;
  category: string;
  expenseType: "RECURRING" | "ONE_TIME";
  payerType: "FIRST_PERSON" | "SECOND_PERSON" | "SHARED";
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  return db.$transaction(async (tx) => {
    let existingExpense = null;

    if (input.expenseId) {
      existingExpense = await requireExpenseInMonth(input.expenseId, input.monthId);
    }

    if (
      input.payerType === PayerType.SECOND_PERSON &&
      month.household.members.length < 2
    ) {
      throw new Error("Den andra personen har inte gått med i hushållet ännu.");
    }

    const legacyPaidAt = existingExpense?.isPaid
      ? existingExpense.paidAt ?? new Date()
      : null;
    const existingFirstPaidAt =
      existingExpense?.payerType === PayerType.SHARED
        ? existingExpense.firstPersonPaidAt ?? legacyPaidAt
        : existingExpense?.payerType === PayerType.FIRST_PERSON
          ? legacyPaidAt
          : null;
    const existingSecondPaidAt =
      existingExpense?.payerType === PayerType.SHARED
        ? existingExpense.secondPersonPaidAt ?? legacyPaidAt
        : existingExpense?.payerType === PayerType.SECOND_PERSON
          ? legacyPaidAt
          : null;
    const firstPersonPaidAt =
      input.payerType === PayerType.SECOND_PERSON ? null : existingFirstPaidAt;
    const secondPersonPaidAt =
      input.payerType === PayerType.FIRST_PERSON ? null : existingSecondPaidAt;
    const isPaid =
      input.payerType === PayerType.SHARED
        ? Boolean(firstPersonPaidAt && secondPersonPaidAt)
        : input.payerType === PayerType.FIRST_PERSON
          ? Boolean(firstPersonPaidAt)
          : Boolean(secondPersonPaidAt);

    const expensePayload = {
      name: input.name,
      amount: input.amount,
      category: input.category,
      expenseType: input.expenseType,
      planningType: existingExpense?.planningType ?? PlanningType.PLANNED,
      payerType: input.payerType,
      dueDate: null,
      isPaid,
      paidAt: isPaid ? existingExpense?.paidAt ?? new Date() : null,
      firstPersonPaidAt,
      secondPersonPaidAt,
      note: null,
      updatedByUserId: input.actorUserId,
    } as const;

    const expense = existingExpense
      ? await tx.expense.update({
          where: {
            id: existingExpense.id,
          },
          data: expensePayload,
        })
      : await tx.expense.create({
          data: {
            budgetMonthId: input.monthId,
            ...expensePayload,
          },
        });

    await syncRecurringExpenseToNextMonth({
      tx,
      actorUserId: input.actorUserId,
      sourceMonth: month,
      sourceExpense: expense,
    });

    return expense;
  });
}

export async function deleteExpenseForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseId: string;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);
  const expense = await requireExpenseInMonth(input.expenseId, input.monthId);

  return db.$transaction(async (tx) => {
    const deletedExpense = await tx.expense.delete({
      where: {
        id: input.expenseId,
      },
    });

    await syncRecurringExpenseToNextMonth({
      tx,
      actorUserId: input.actorUserId,
      sourceMonth: month,
      sourceExpense: {
        ...expense,
        expenseType: "ONE_TIME",
      },
    });

    return deletedExpense;
  });
}

export async function setExpensePaidStateForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseId: string;
  nextPaidState: "paid" | "unpaid";
  targetPayerType?: "FIRST_PERSON" | "SECOND_PERSON";
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);
  const expense = await requireExpenseInMonth(input.expenseId, input.monthId);
  const nextPaidAt = input.nextPaidState === "paid" ? new Date() : null;

  if (expense.payerType === PayerType.SHARED) {
    if (!input.targetPayerType) {
      throw new Error("Välj vilken persons del som ska ändras.");
    }

    const legacyPaidAt = expense.isPaid ? expense.paidAt ?? new Date() : null;
    const firstPersonPaidAt =
      input.targetPayerType === PayerType.FIRST_PERSON
        ? nextPaidAt
        : expense.firstPersonPaidAt ?? legacyPaidAt;
    const secondPersonPaidAt =
      input.targetPayerType === PayerType.SECOND_PERSON
        ? nextPaidAt
        : expense.secondPersonPaidAt ?? legacyPaidAt;
    const isPaid = Boolean(firstPersonPaidAt && secondPersonPaidAt);

    return db.expense.update({
      where: {
        id: input.expenseId,
      },
      data: {
        isPaid,
        paidAt: isPaid ? new Date() : null,
        firstPersonPaidAt,
        secondPersonPaidAt,
        swishId: isPaid ? undefined : null,
        updatedByUserId: input.actorUserId,
      },
    });
  }

  if (input.targetPayerType && input.targetPayerType !== expense.payerType) {
    throw new Error("Personen är inte tilldelad den här utgiften.");
  }

  return db.expense.update({
    where: {
      id: input.expenseId,
    },
    data: {
      isPaid: input.nextPaidState === "paid",
      paidAt: nextPaidAt,
      firstPersonPaidAt:
        expense.payerType === PayerType.FIRST_PERSON ? nextPaidAt : null,
      secondPersonPaidAt:
        expense.payerType === PayerType.SECOND_PERSON ? nextPaidAt : null,
      swishId: input.nextPaidState === "paid" ? undefined : null,
      updatedByUserId: input.actorUserId,
    },
  });
}

export async function settleExpensesWithSwishForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseIds: string[];
  swishId: string;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  return db.$transaction(async (tx) => {
    const expenses = await tx.expense.findMany({
      where: {
        budgetMonthId: input.monthId,
        id: {
          in: input.expenseIds,
        },
      },
      select: {
        id: true,
        amount: true,
        isPaid: true,
        payerType: true,
      },
    });

    if (expenses.length !== input.expenseIds.length) {
      throw new Error("Någon av utgifterna hittades inte.");
    }

    if (expenses.some((expense) => expense.isPaid)) {
      throw new Error("Det går bara att Swish-markera obetalda utgifter.");
    }

    const paidAt = new Date();
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    await Promise.all(
      expenses.map((expense) =>
        tx.expense.update({
          where: {
            id: expense.id,
          },
          data: {
            isPaid: true,
            paidAt,
            firstPersonPaidAt:
              expense.payerType === PayerType.SECOND_PERSON ? null : paidAt,
            secondPersonPaidAt:
              expense.payerType === PayerType.FIRST_PERSON ? null : paidAt,
            swishId: input.swishId,
            updatedByUserId: input.actorUserId,
          },
        }),
      ),
    );

    return {
      count: expenses.length,
      totalAmount,
      paidAt,
      swishId: input.swishId,
    };
  });
}

export async function getExpensesBySwishIdForUser(input: {
  actorUserId: string;
  swishId: string;
}) {
  const household = await getHouseholdForUser(input.actorUserId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan söka på Swish ID.");
  }

  const expenses = await db.expense.findMany({
    where: {
      swishId: input.swishId,
      budgetMonth: {
        householdId: household.id,
      },
    },
    include: {
      budgetMonth: {
        select: {
          monthKey: true,
        },
      },
      updatedByUser: true,
    },
    orderBy: [
      {
        paidAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return {
    swishId: input.swishId,
    totalAmount: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    expenses,
  };
}
