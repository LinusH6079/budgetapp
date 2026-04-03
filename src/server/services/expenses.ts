import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/date";
import { assertMonthEditable } from "@/server/services/access";

async function requireExpenseAccess(actorUserId: string, monthId: string) {
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

  if (!month || !month.household.members.some((member) => member.userId === actorUserId)) {
    throw new Error("Månaden hittades inte.");
  }

  return month;
}

function asDate(value: string | undefined) {
  return parseDateInput(value);
}

export async function upsertExpenseForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseId?: string | null;
  name: string;
  amount: number;
  category: string;
  expenseType: "RECURRING" | "ONE_TIME";
  planningType: "PLANNED" | "UNPLANNED";
  payerType: "FIRST_PERSON" | "SECOND_PERSON" | "SHARED";
  dueDate?: string;
  isPaid: boolean;
  paidAt?: string;
  note?: string;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  const expensePayload = {
    name: input.name,
    amount: input.amount,
    category: input.category,
    expenseType: input.expenseType,
    planningType: input.planningType,
    payerType: input.payerType,
    dueDate: asDate(input.dueDate),
    isPaid: input.isPaid,
    paidAt: input.isPaid ? asDate(input.paidAt) ?? new Date() : null,
    note: input.note || null,
    updatedByUserId: input.actorUserId,
  } as const;

  if (input.expenseId) {
    return db.expense.update({
      where: {
        id: input.expenseId,
      },
      data: expensePayload,
    });
  }

  return db.expense.create({
    data: {
      budgetMonthId: input.monthId,
      ...expensePayload,
    },
  });
}

export async function deleteExpenseForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseId: string;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  return db.expense.delete({
    where: {
      id: input.expenseId,
    },
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
