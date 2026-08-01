import {
  ExpenseOrigin,
  Prisma,
  PayerType,
  PlanningType,
} from "@prisma/client";

import { db } from "@/lib/db";
import { getNextMonthKey } from "@/lib/date";
import { expensePartAmount } from "@/lib/budget-calculations";
import { expenseAnnualContributionAmount } from "@/lib/annual-budget-calculations";
import { assertMonthEditable } from "@/server/services/access";
import { syncAutomaticAnnualSavingExpenses } from "@/server/services/annual-saving-expenses";
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
    include: {
      annualSavingEntries: true,
    },
  });

  if (!expense) {
    throw new Error("Utgiften hittades inte.");
  }

  return expense;
}

async function assertAnnualBudgetItemAvailable(input: {
  tx: Prisma.TransactionClient;
  annualBudgetItemId: string;
  householdId: string;
}) {
  const item = await input.tx.annualBudgetItem.findFirst({
    where: {
      id: input.annualBudgetItemId,
      householdId: input.householdId,
      isArchived: false,
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw new Error("Årskostnaden hittades inte eller är redan avslutad.");
  }
}

async function syncExpenseAnnualContribution(input: {
  tx: Prisma.TransactionClient;
  actorUserId: string;
  householdId: string;
  expense: {
    id: string;
    amount: number;
    isPaid: boolean;
    annualBudgetItemId: string | null;
  };
}) {
  const existingEntry = await input.tx.annualSavingEntry.findFirst({
    where: {
      sourceExpenseId: input.expense.id,
    },
  });
  const targetItem = input.expense.annualBudgetItemId
    ? await input.tx.annualBudgetItem.findFirst({
        where: {
          id: input.expense.annualBudgetItemId,
          householdId: input.householdId,
          isArchived: false,
        },
        select: {
          id: true,
        },
      })
    : null;
  const contributionAmount = expenseAnnualContributionAmount({
    amount: input.expense.amount,
    isPaid: input.expense.isPaid,
    hasActiveAnnualBudgetItem: Boolean(targetItem),
  });

  if (contributionAmount === 0 || !targetItem) {
    if (existingEntry) {
      await input.tx.annualSavingEntry.delete({
        where: {
          id: existingEntry.id,
        },
      });
      await input.tx.annualBudgetItem.update({
        where: {
          id: existingEntry.annualBudgetItemId,
        },
        data: {
          updatedByUserId: input.actorUserId,
        },
      });
    }
    return;
  }

  await input.tx.annualSavingEntry.deleteMany({
    where: {
      sourceExpenseId: input.expense.id,
    },
  });
  await input.tx.annualSavingEntry.create({
    data: {
      annualBudgetItemId: targetItem.id,
      sourceExpenseId: input.expense.id,
      amount: contributionAmount,
      entryType: "CONTRIBUTION",
      updatedByUserId: input.actorUserId,
    },
  });

  const touchedItemIds = new Set([
    targetItem.id,
    existingEntry?.annualBudgetItemId,
  ]);
  await input.tx.annualBudgetItem.updateMany({
    where: {
      id: {
        in: [...touchedItemIds].filter((id): id is string => Boolean(id)),
      },
    },
    data: {
      updatedByUserId: input.actorUserId,
    },
  });
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
    origin: "STANDARD" | "ANNUAL_SAVING";
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
  annualBudgetItemId?: string | null;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  return db.$transaction(async (tx) => {
    let existingExpense = null;

    if (input.expenseId) {
      existingExpense = await requireExpenseInMonth(input.expenseId, input.monthId);
      if (existingExpense.origin === ExpenseOrigin.ANNUAL_SAVING) {
        throw new Error("Automatiskt årssparande justeras från årsbudgeten.");
      }
    }

    if (input.annualBudgetItemId) {
      await assertAnnualBudgetItemAvailable({
        tx,
        annualBudgetItemId: input.annualBudgetItemId,
        householdId: month.householdId,
      });
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
    const firstPersonSwishId =
      input.payerType === PayerType.SECOND_PERSON
        ? null
        : existingExpense?.firstPersonSwishId ?? null;
    const secondPersonSwishId =
      input.payerType === PayerType.FIRST_PERSON
        ? null
        : existingExpense?.secondPersonSwishId ?? null;
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
      origin: ExpenseOrigin.STANDARD,
      planningType: existingExpense?.planningType ?? PlanningType.PLANNED,
      payerType: input.payerType,
      dueDate: null,
      isPaid,
      paidAt: isPaid ? existingExpense?.paidAt ?? new Date() : null,
      firstPersonPaidAt,
      secondPersonPaidAt,
      firstPersonSwishId,
      secondPersonSwishId,
      note: null,
      annualBudgetItemId: input.annualBudgetItemId ?? null,
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

    await syncExpenseAnnualContribution({
      tx,
      actorUserId: input.actorUserId,
      householdId: month.householdId,
      expense,
    });

    await syncRecurringExpenseToNextMonth({
      tx,
      actorUserId: input.actorUserId,
      sourceMonth: month,
      sourceExpense: expense,
    });

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: month.householdId,
      actorUserId: input.actorUserId,
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
    if (
      expense.origin === ExpenseOrigin.ANNUAL_SAVING &&
      expense.annualBudgetItemId
    ) {
      await tx.annualSavingOverride.upsert({
        where: {
          budgetMonthId_annualBudgetItemId: {
            budgetMonthId: input.monthId,
            annualBudgetItemId: expense.annualBudgetItemId,
          },
        },
        create: {
          budgetMonthId: input.monthId,
          annualBudgetItemId: expense.annualBudgetItemId,
          createdByUserId: input.actorUserId,
        },
        update: {
          createdByUserId: input.actorUserId,
        },
      });
    }

    const deletedExpense = await tx.expense.delete({
      where: {
        id: input.expenseId,
      },
    });

    const annualSavingEntry = expense.annualSavingEntries[0];
    if (annualSavingEntry) {
      await tx.annualBudgetItem.update({
        where: {
          id: annualSavingEntry.annualBudgetItemId,
        },
        data: {
          updatedByUserId: input.actorUserId,
        },
      });
    }

    await syncRecurringExpenseToNextMonth({
      tx,
      actorUserId: input.actorUserId,
      sourceMonth: month,
      sourceExpense: {
        ...expense,
        expenseType: "ONE_TIME",
      },
    });

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: month.householdId,
      actorUserId: input.actorUserId,
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
  const updateAndSyncAnnual = (
    data: Prisma.ExpenseUncheckedUpdateInput,
  ) =>
    db.$transaction(async (tx) => {
      const updatedExpense = await tx.expense.update({
        where: {
          id: input.expenseId,
        },
        data,
      });

      await syncExpenseAnnualContribution({
        tx,
        actorUserId: input.actorUserId,
        householdId: month.householdId,
        expense: updatedExpense,
      });

      await syncAutomaticAnnualSavingExpenses({
        tx,
        householdId: month.householdId,
        actorUserId: input.actorUserId,
      });

      return updatedExpense;
    });

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

    return updateAndSyncAnnual({
        isPaid,
        paidAt: isPaid ? new Date() : null,
        firstPersonPaidAt,
        secondPersonPaidAt,
        firstPersonSwishId:
          input.targetPayerType === PayerType.FIRST_PERSON && !nextPaidAt
            ? null
            : undefined,
        secondPersonSwishId:
          input.targetPayerType === PayerType.SECOND_PERSON && !nextPaidAt
            ? null
            : undefined,
        swishId: null,
        updatedByUserId: input.actorUserId,
    });
  }

  if (input.targetPayerType && input.targetPayerType !== expense.payerType) {
    throw new Error("Personen är inte tilldelad den här utgiften.");
  }

  return updateAndSyncAnnual({
      isPaid: input.nextPaidState === "paid",
      paidAt: nextPaidAt,
      firstPersonPaidAt:
        expense.payerType === PayerType.FIRST_PERSON ? nextPaidAt : null,
      secondPersonPaidAt:
        expense.payerType === PayerType.SECOND_PERSON ? nextPaidAt : null,
      firstPersonSwishId: null,
      secondPersonSwishId: null,
      swishId: input.nextPaidState === "paid" ? undefined : null,
      updatedByUserId: input.actorUserId,
  });
}

export async function settleExpensesWithSwishForUser(input: {
  actorUserId: string;
  monthId: string;
  selections: Array<{
    expenseId: string;
    targetPayerType?: "FIRST_PERSON" | "SECOND_PERSON";
  }>;
  swishId: string;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);

  return db.$transaction(async (tx) => {
    const expenseIds = [
      ...new Set(input.selections.map((selection) => selection.expenseId)),
    ];
    const expenses = await tx.expense.findMany({
      where: {
        budgetMonthId: input.monthId,
        id: {
          in: expenseIds,
        },
      },
    });

    if (expenses.length !== expenseIds.length) {
      throw new Error("Någon av utgifterna hittades inte.");
    }

    const paidAt = new Date();
    const states = new Map(
      expenses.map((expense) => [
        expense.id,
        {
          expense,
          firstPersonPaidAt:
            expense.firstPersonPaidAt ??
            (expense.payerType === PayerType.SHARED && expense.isPaid
              ? expense.paidAt
              : null),
          secondPersonPaidAt:
            expense.secondPersonPaidAt ??
            (expense.payerType === PayerType.SHARED && expense.isPaid
              ? expense.paidAt
              : null),
          firstPersonSwishId: expense.firstPersonSwishId,
          secondPersonSwishId: expense.secondPersonSwishId,
          selectedSingle: false,
        },
      ]),
    );
    let totalAmount = 0;

    for (const selection of input.selections) {
      const state = states.get(selection.expenseId);

      if (!state) {
        throw new Error("Utgiften hittades inte.");
      }

      if (state.expense.payerType === PayerType.SHARED) {
        if (!selection.targetPayerType) {
          throw new Error("Välj vilken persons halva som ska Swish-markeras.");
        }

        if (selection.targetPayerType === PayerType.FIRST_PERSON) {
          if (state.firstPersonPaidAt) {
            throw new Error("Den valda delen är redan betald.");
          }
          state.firstPersonPaidAt = paidAt;
          state.firstPersonSwishId = input.swishId;
          totalAmount += expensePartAmount(
            state.expense.amount,
            PayerType.FIRST_PERSON,
          );
        } else {
          if (state.secondPersonPaidAt) {
            throw new Error("Den valda delen är redan betald.");
          }
          state.secondPersonPaidAt = paidAt;
          state.secondPersonSwishId = input.swishId;
          totalAmount += expensePartAmount(
            state.expense.amount,
            PayerType.SECOND_PERSON,
          );
        }
      } else {
        if (
          selection.targetPayerType &&
          selection.targetPayerType !== state.expense.payerType
        ) {
          throw new Error("Personen är inte tilldelad den här utgiften.");
        }
        if (state.expense.isPaid || state.selectedSingle) {
          throw new Error("Den valda utgiften är redan betald.");
        }
        state.selectedSingle = true;
        totalAmount += state.expense.amount;
      }
    }

    await Promise.all(
      [...states.values()].map(async (state) => {
        const isShared = state.expense.payerType === PayerType.SHARED;
        const isPaid = isShared
          ? Boolean(state.firstPersonPaidAt && state.secondPersonPaidAt)
          : state.selectedSingle;
        const sharedSwishId =
          isShared &&
          state.firstPersonSwishId &&
          state.firstPersonSwishId === state.secondPersonSwishId
            ? state.firstPersonSwishId
            : null;

        const updatedExpense = await tx.expense.update({
          where: {
            id: state.expense.id,
          },
          data: {
            isPaid,
            paidAt: isPaid ? paidAt : null,
            firstPersonPaidAt: isShared
              ? state.firstPersonPaidAt
              : state.expense.payerType === PayerType.FIRST_PERSON
                ? paidAt
                : null,
            secondPersonPaidAt: isShared
              ? state.secondPersonPaidAt
              : state.expense.payerType === PayerType.SECOND_PERSON
                ? paidAt
                : null,
            firstPersonSwishId: isShared
              ? state.firstPersonSwishId
              : null,
            secondPersonSwishId: isShared
              ? state.secondPersonSwishId
              : null,
            swishId: isShared ? sharedSwishId : input.swishId,
            updatedByUserId: input.actorUserId,
          },
        });

        await syncExpenseAnnualContribution({
          tx,
          actorUserId: input.actorUserId,
          householdId: month.householdId,
          expense: updatedExpense,
        });

        return updatedExpense;
      }),
    );

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: month.householdId,
      actorUserId: input.actorUserId,
    });

    return {
      count: input.selections.length,
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
      OR: [
        { swishId: input.swishId },
        { firstPersonSwishId: input.swishId },
        { secondPersonSwishId: input.swishId },
      ],
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

  const matches = expenses.map((expense) => {
    const firstMatches = expense.firstPersonSwishId === input.swishId;
    const secondMatches = expense.secondPersonSwishId === input.swishId;
    const matchedByWholeExpense = expense.swishId === input.swishId;
    if (
      expense.payerType === PayerType.SHARED &&
      !matchedByWholeExpense &&
      firstMatches !== secondMatches
    ) {
      return {
        ...expense,
        settlementAmount: expensePartAmount(
          expense.amount,
          firstMatches ? PayerType.FIRST_PERSON : PayerType.SECOND_PERSON,
        ),
        settlementPayerType: firstMatches
          ? PayerType.FIRST_PERSON
          : PayerType.SECOND_PERSON,
      };
    }

    return {
      ...expense,
      settlementAmount: expense.amount,
      settlementPayerType: expense.payerType,
    };
  });

  return {
    swishId: input.swishId,
    totalAmount: matches.reduce(
      (sum, expense) => sum + expense.settlementAmount,
      0,
    ),
    expenses: matches,
  };
}
