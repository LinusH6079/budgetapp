import { Prisma, PayerType, PlanningType } from "@prisma/client";

import { db } from "@/lib/db";
import { getNextMonthKey } from "@/lib/date";
import { assertMonthEditable } from "@/server/services/access";
import { buildRecurringExpenseCopyData } from "@/server/services/budget-months";

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

function getActorPayerType(
  members: Array<{
    userId: string;
  }>,
  actorUserId: string,
) {
  const actorIndex = members.findIndex((member) => member.userId === actorUserId);

  if (actorIndex === 0) {
    return PayerType.FIRST_PERSON;
  }

  if (actorIndex === 1) {
    return PayerType.SECOND_PERSON;
  }

  throw new Error("Kunde inte koppla utgiften till rätt person.");
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
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  return db.$transaction(async (tx) => {
    let existingExpense = null;

    if (input.expenseId) {
      existingExpense = await requireExpenseInMonth(input.expenseId, input.monthId);
    }

    const expensePayload = {
      name: input.name,
      amount: input.amount,
      category: input.category,
      expenseType: input.expenseType,
      planningType: existingExpense?.planningType ?? PlanningType.PLANNED,
      payerType: existingExpense?.payerType ?? getActorPayerType(month.household.members, input.actorUserId),
      dueDate: null,
      isPaid: existingExpense?.isPaid ?? false,
      paidAt: existingExpense?.paidAt ?? null,
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
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);
  await requireExpenseInMonth(input.expenseId, input.monthId);

  return db.expense.update({
    where: {
      id: input.expenseId,
    },
    data: {
      isPaid: input.nextPaidState === "paid",
      paidAt: input.nextPaidState === "paid" ? new Date() : null,
      updatedByUserId: input.actorUserId,
    },
  });
}
