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
import { buildSwishHistory } from "@/lib/swish-history";
import { assertMonthEditable } from "@/server/services/access";
import { syncAutomaticAnnualSavingExpenses } from "@/server/services/annual-saving-expenses";
import { buildRecurringExpenseCopyData } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";
import { syncLoanExpenses } from "@/server/services/loan-payment-sync";
import {
  rebuildLoanAfterExtraPayment,
  syncLoanStatusFromInstallments,
} from "@/server/services/loans";

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
      loanExtraPayment: true,
      loanInstallment: true,
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

function isRetryableTransactionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";

  return (
    code === "P2028" ||
    code === "P2034" ||
    message.includes("Transaction already closed") ||
    message.includes("expired transaction")
  );
}

async function syncAnnualSavingPlanWithRetry(input: {
  householdId: string;
  actorUserId: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await db.$transaction(
        (tx) =>
          syncAutomaticAnnualSavingExpenses({
            tx,
            householdId: input.householdId,
            actorUserId: input.actorUserId,
          }),
        { maxWait: 10_000, timeout: 30_000 },
      );
      return;
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 2) {
        // The paid state and contribution are already committed. A later annual
        // budget read retries the derived schedule without reverting the payment.
        console.error("Kunde inte räkna om årssparplanen efter betalning.", error);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

}

async function runTransactionWithRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        maxWait: 10_000,
        timeout: 30_000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;

      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  throw lastError;
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
    origin: ExpenseOrigin;
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
  const existingExpense = input.expenseId
    ? await requireExpenseInMonth(input.expenseId, input.monthId)
    : null;

  if (existingExpense?.origin === ExpenseOrigin.ANNUAL_SAVING) {
    throw new Error("Automatiskt årssparande justeras från årsbudgeten.");
  }
  if (
    existingExpense?.origin === ExpenseOrigin.LOAN_PAYMENT ||
    existingExpense?.origin === ExpenseOrigin.LOAN_EXTRA_PAYMENT
  ) {
    throw new Error("Låneutgiften justeras från Lån & finansiering.");
  }

  const shouldSyncAnnualSavings = Boolean(
    input.annualBudgetItemId || existingExpense?.annualBudgetItemId,
  );

  return db.$transaction(async (tx) => {
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

    if (shouldSyncAnnualSavings) {
      await syncExpenseAnnualContribution({
        tx,
        actorUserId: input.actorUserId,
        householdId: month.householdId,
        expense,
      });
    }

    if (
      input.expenseType === "RECURRING" ||
      existingExpense?.expenseType === "RECURRING"
    ) {
      await syncRecurringExpenseToNextMonth({
        tx,
        actorUserId: input.actorUserId,
        sourceMonth: month,
        sourceExpense: expense,
      });
    }

    if (shouldSyncAnnualSavings) {
      await syncAutomaticAnnualSavingExpenses({
        tx,
        householdId: month.householdId,
        actorUserId: input.actorUserId,
      });
    }

    return expense;
  }, { maxWait: 5_000, timeout: 20_000 });
}

export async function updateAnnualSavingExpenseAmountForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseId: string;
  amount: number;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);
  const expense = await requireExpenseInMonth(input.expenseId, input.monthId);

  if (
    expense.origin !== ExpenseOrigin.ANNUAL_SAVING ||
    !expense.annualBudgetItemId
  ) {
    throw new Error("Endast automatiskt årssparande kan justeras här.");
  }

  if (
    expense.isPaid ||
    expense.firstPersonPaidAt ||
    expense.secondPersonPaidAt
  ) {
    throw new Error("Markera sparandet som obetalt innan beloppet ändras.");
  }

  return db.$transaction(async (tx) => {
    await tx.annualSavingOverride.upsert({
      where: {
        budgetMonthId_annualBudgetItemId: {
          budgetMonthId: input.monthId,
          annualBudgetItemId: expense.annualBudgetItemId!,
        },
      },
      create: {
        budgetMonthId: input.monthId,
        annualBudgetItemId: expense.annualBudgetItemId!,
        amount: input.amount,
        createdByUserId: input.actorUserId,
      },
      update: {
        amount: input.amount,
        createdByUserId: input.actorUserId,
      },
    });

    await tx.annualBudgetItem.update({
      where: { id: expense.annualBudgetItemId! },
      data: { updatedByUserId: input.actorUserId },
    });

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: month.householdId,
      actorUserId: input.actorUserId,
    });

    return tx.expense.findUnique({ where: { id: input.expenseId } });
  }, { maxWait: 5_000, timeout: 20_000 });
}

export async function deleteExpenseForUser(input: {
  actorUserId: string;
  monthId: string;
  expenseId: string;
}) {
  const month = await requireExpenseAccess(input.actorUserId, input.monthId);
  assertMonthEditable(month.isLocked);
  const expense = await requireExpenseInMonth(input.expenseId, input.monthId);

  if (expense.loanInstallment) {
    throw new Error("Lånebetalningen hanteras från Lån & finansiering.");
  }

  return db.$transaction(async (tx) => {
    if (expense.loanExtraPayment) {
      if (expense.isPaid) {
        throw new Error("Markera extra amorteringen som obetald innan den tas bort.");
      }
      await tx.loanExtraPayment.delete({
        where: { id: expense.loanExtraPayment.id },
      });
    }
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
          amount: 0,
          createdByUserId: input.actorUserId,
        },
        update: {
          amount: 0,
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
  }, { maxWait: 5_000, timeout: 20_000 });
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
  const requiresAnnualSync = Boolean(
    expense.annualBudgetItemId || expense.annualSavingEntries.length > 0,
  );
  const requiresLoanSync = Boolean(
    expense.loanExtraPayment || expense.loanInstallment,
  );
  type PaidStateSource = Pick<
    typeof expense,
    | "isPaid"
    | "paidAt"
    | "firstPersonPaidAt"
    | "secondPersonPaidAt"
  >;
  const updatePaidState = async (
    dataOrBuilder:
      | Prisma.ExpenseUncheckedUpdateInput
      | ((current: PaidStateSource) => Prisma.ExpenseUncheckedUpdateInput),
  ) => {
    const requiresTransaction =
      expense.payerType === PayerType.SHARED ||
      requiresAnnualSync ||
      requiresLoanSync;

    if (!requiresTransaction && typeof dataOrBuilder !== "function") {
      return db.expense.update({
        where: {
          id: input.expenseId,
        },
        data: dataOrBuilder,
      });
    }

    const updatedExpense = await runTransactionWithRetry(async (tx) => {
      const data =
        typeof dataOrBuilder === "function"
          ? dataOrBuilder(
              await tx.expense.findUniqueOrThrow({
                where: { id: input.expenseId },
                select: {
                  isPaid: true,
                  paidAt: true,
                  firstPersonPaidAt: true,
                  secondPersonPaidAt: true,
                },
              }),
            )
          : dataOrBuilder;
      const updatedExpense = await tx.expense.update({
        where: {
          id: input.expenseId,
        },
        data,
      });

      if (requiresAnnualSync) {
        await syncExpenseAnnualContribution({
          tx,
          actorUserId: input.actorUserId,
          householdId: month.householdId,
          expense: updatedExpense,
        });
      }

      if (expense.loanExtraPayment) {
        await rebuildLoanAfterExtraPayment({
          tx,
          actorUserId: input.actorUserId,
          loanId: expense.loanExtraPayment.loanId,
          monthKey: expense.loanExtraPayment.monthKey,
        });
      }

      if (expense.loanInstallment) {
        await syncLoanStatusFromInstallments({
          tx,
          actorUserId: input.actorUserId,
          loanId: expense.loanInstallment.loanId,
        });
      }

      if (requiresLoanSync) {
        await syncLoanExpenses({
          tx,
          householdId: month.householdId,
          actorUserId: input.actorUserId,
        });
      }

      return updatedExpense;
    });

    if (requiresAnnualSync) {
      await syncAnnualSavingPlanWithRetry({
        householdId: month.householdId,
        actorUserId: input.actorUserId,
      });
    }

    return updatedExpense;
  };

  if (expense.payerType === PayerType.SHARED) {
    if (!input.targetPayerType) {
      throw new Error("Välj vilken persons del som ska ändras.");
    }

    return updatePaidState((current) => {
      const legacyPaidAt = current.isPaid
        ? current.paidAt ?? new Date()
        : null;
      const firstPersonPaidAt =
        input.targetPayerType === PayerType.FIRST_PERSON
          ? nextPaidAt
          : current.firstPersonPaidAt ?? legacyPaidAt;
      const secondPersonPaidAt =
        input.targetPayerType === PayerType.SECOND_PERSON
          ? nextPaidAt
          : current.secondPersonPaidAt ?? legacyPaidAt;
      const isPaid = Boolean(firstPersonPaidAt && secondPersonPaidAt);

      return {
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
      };
    });
  }

  if (input.targetPayerType && input.targetPayerType !== expense.payerType) {
    throw new Error("Personen är inte tilldelad den här utgiften.");
  }

  return updatePaidState({
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

  const result = await runTransactionWithRetry(async (tx) => {
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
            if (state.firstPersonSwishId !== input.swishId) {
              throw new Error("Den valda delen är redan betald.");
            }
          } else {
            state.firstPersonPaidAt = paidAt;
            state.firstPersonSwishId = input.swishId;
          }
          totalAmount += expensePartAmount(
            state.expense.amount,
            PayerType.FIRST_PERSON,
            state.expense.firstPersonSharePercent ?? 50,
          );
        } else {
          if (state.secondPersonPaidAt) {
            if (state.secondPersonSwishId !== input.swishId) {
              throw new Error("Den valda delen är redan betald.");
            }
          } else {
            state.secondPersonPaidAt = paidAt;
            state.secondPersonSwishId = input.swishId;
          }
          totalAmount += expensePartAmount(
            state.expense.amount,
            PayerType.SECOND_PERSON,
            state.expense.firstPersonSharePercent ?? 50,
          );
        }
      } else {
        if (
          selection.targetPayerType &&
          selection.targetPayerType !== state.expense.payerType
        ) {
          throw new Error("Personen är inte tilldelad den här utgiften.");
        }
        if (
          (state.expense.isPaid && state.expense.swishId !== input.swishId) ||
          state.selectedSingle
        ) {
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

        if (updatedExpense.annualBudgetItemId) {
          await syncExpenseAnnualContribution({
            tx,
            actorUserId: input.actorUserId,
            householdId: month.householdId,
            expense: updatedExpense,
          });
        }

        return updatedExpense;
      }),
    );

    const hasLoanExpenses = expenses.some(
      (expense) =>
        expense.origin === ExpenseOrigin.LOAN_PAYMENT ||
        expense.origin === ExpenseOrigin.LOAN_EXTRA_PAYMENT,
    );

    if (hasLoanExpenses) {
      const affectedExtraPayments = await tx.loanExtraPayment.findMany({
        where: { expenseId: { in: expenseIds } },
        select: { loanId: true, monthKey: true },
      });
      for (const payment of affectedExtraPayments) {
        await rebuildLoanAfterExtraPayment({
          tx,
          actorUserId: input.actorUserId,
          loanId: payment.loanId,
          monthKey: payment.monthKey,
        });
      }
      const affectedInstallments = await tx.loanInstallment.findMany({
        where: { expenseId: { in: expenseIds } },
        select: { loanId: true },
      });
      for (const loanId of new Set(affectedInstallments.map((row) => row.loanId))) {
        await syncLoanStatusFromInstallments({
          tx,
          actorUserId: input.actorUserId,
          loanId,
        });
      }
      await syncLoanExpenses({
        tx,
        householdId: month.householdId,
        actorUserId: input.actorUserId,
      });
    }

    return {
      count: input.selections.length,
      totalAmount,
      paidAt,
      swishId: input.swishId,
      hasAnnualSavings: expenses.some((expense) => expense.annualBudgetItemId),
    };
  });

  if (result.hasAnnualSavings) {
    await syncAnnualSavingPlanWithRetry({
      householdId: month.householdId,
      actorUserId: input.actorUserId,
    });
  }

  return {
    count: result.count,
    totalAmount: result.totalAmount,
    paidAt: result.paidAt,
    swishId: result.swishId,
  };
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
          expense.firstPersonSharePercent ?? 50,
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

export async function getSwishHistoryForUser(actorUserId: string) {
  const household = await getHouseholdForUser(actorUserId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan se Swish-historik.");
  }

  const expenses = await db.expense.findMany({
    where: {
      budgetMonth: {
        householdId: household.id,
      },
      OR: [
        { swishId: { not: null } },
        { firstPersonSwishId: { not: null } },
        { secondPersonSwishId: { not: null } },
      ],
    },
    select: {
      id: true,
      amount: true,
      payerType: true,
      swishId: true,
      firstPersonSwishId: true,
      secondPersonSwishId: true,
      paidAt: true,
      updatedAt: true,
      budgetMonth: {
        select: {
          monthKey: true,
        },
      },
    },
  });

  return buildSwishHistory(expenses);
}
