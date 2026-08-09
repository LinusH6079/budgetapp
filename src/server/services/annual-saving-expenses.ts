import {
  ExpenseOrigin,
  ExpenseType,
  PayerType,
  PlanningType,
  Prisma,
} from "@prisma/client";

import {
  allocateAnnualSavingByMonth,
  annualBudgetCurrentMonthKey,
  annualSavingMonthKeys,
  buildGuaranteedAnnualSavingSchedule,
  effectiveAnnualSavingRate,
  netReservedAmount,
} from "@/lib/annual-budget-calculations";

type SyncAutomaticAnnualSavingExpensesInput = {
  tx: Prisma.TransactionClient;
  householdId: string;
  actorUserId: string;
  now?: Date;
};

export async function syncAutomaticAnnualSavingExpenses({
  tx,
  householdId,
  actorUserId,
  now = new Date(),
}: SyncAutomaticAnnualSavingExpensesInput) {
  const currentMonthKey = annualBudgetCurrentMonthKey(now);
  const [items, months, memberCount] = await Promise.all([
    tx.annualBudgetItem.findMany({
      where: {
        householdId,
        isArchived: false,
      },
      include: {
        entries: true,
        savingRates: {
          orderBy: {
            startMonth: "asc",
          },
        },
        savingOverrides: {
          include: {
            budgetMonth: {
              select: {
                monthKey: true,
              },
            },
          },
        },
      },
    }),
    tx.budgetMonth.findMany({
      where: {
        householdId,
        monthKey: {
          gte: currentMonthKey,
        },
      },
      select: {
        id: true,
        monthKey: true,
        isLocked: true,
        expenses: {
          where: {
            origin: ExpenseOrigin.ANNUAL_SAVING,
          },
          select: {
            id: true,
            annualBudgetItemId: true,
            name: true,
            amount: true,
            category: true,
            expenseType: true,
            payerType: true,
            firstPersonSharePercent: true,
            isPaid: true,
            firstPersonPaidAt: true,
            secondPersonPaidAt: true,
          },
        },
      },
      orderBy: {
        monthKey: "asc",
      },
    }),
    tx.householdMember.count({
      where: {
        householdId,
      },
    }),
  ]);

  const activeItemIds = new Set(items.map((item) => item.id));
  const retainedExpenseIds = new Set<string>();

  for (const item of items) {
    const firstPersonSharePercent = memberCount >= 2
      ? item.firstPersonSharePercent
      : 100;
    const payerType =
      firstPersonSharePercent === 100
        ? PayerType.FIRST_PERSON
        : firstPersonSharePercent === 0
          ? PayerType.SECOND_PERSON
          : PayerType.SHARED;
    const overrideAmounts = new Map(
      item.savingOverrides.map((override) => [
        override.budgetMonth.monthKey,
        override.amount,
      ]),
    );
    const itemExpenses = months.flatMap((month) =>
      month.expenses
        .filter((expense) => expense.annualBudgetItemId === item.id)
        .map((expense) => ({ ...expense, month })),
    );
    const immutableExpenses = itemExpenses.filter(
      (expense) =>
        expense.isPaid ||
        expense.month.isLocked ||
        Boolean(expense.firstPersonPaidAt || expense.secondPersonPaidAt),
    );
    const immutableMonthKeys = new Set(
      immutableExpenses.map((expense) => expense.month.monthKey),
    );
    immutableExpenses.forEach((expense) => retainedExpenseIds.add(expense.id));
    const committedUnfundedAmount = immutableExpenses.reduce(
      (sum, expense) => sum + (expense.isPaid ? 0 : expense.amount),
      0,
    );
    const allTargetMonthKeys = annualSavingMonthKeys(
      item.savingStartMonth && item.savingStartMonth > currentMonthKey
        ? item.savingStartMonth
        : currentMonthKey,
      item.dueMonth,
    );
    const fixedOverrideTotal = allTargetMonthKeys.reduce(
      (sum, monthKey) =>
        sum +
        (immutableMonthKeys.has(monthKey)
          ? 0
          : Math.max(0, overrideAmounts.get(monthKey) ?? 0)),
      0,
    );
    const availableTargetMonthKeys = allTargetMonthKeys.filter(
      (monthKey) =>
        !overrideAmounts.has(monthKey) &&
        !immutableMonthKeys.has(monthKey),
    );
    const remainingTargetAmount =
      item.targetAmount -
      netReservedAmount(item.entries) -
      committedUnfundedAmount -
      fixedOverrideTotal;
    const allocationByMonth =
      item.savingMode === "CUSTOM_SCHEDULE"
        ? new Map([
            ...buildGuaranteedAnnualSavingSchedule({
              remainingAmount: remainingTargetAmount,
              monthKeys: availableTargetMonthKeys,
              rates: item.savingRates,
            }).schedule.map((allocation) => [
              allocation.monthKey,
              allocation.amount,
            ] as const),
            ...months
              .filter(
                (month) =>
                  month.monthKey > item.dueMonth &&
                  !overrideAmounts.has(month.monthKey) &&
                  !immutableMonthKeys.has(month.monthKey),
              )
              .map((month) => [
                month.monthKey,
                effectiveAnnualSavingRate(
                  item.savingRates,
                  month.monthKey,
                ),
              ] as const),
          ])
        : new Map(
            allocateAnnualSavingByMonth({
              remainingAmount: remainingTargetAmount,
              monthKeys: availableTargetMonthKeys,
            }).map((allocation) => [
              allocation.monthKey,
              allocation.amount,
            ] as const),
          );

    for (const [monthKey, amount] of overrideAmounts) {
      if (!immutableMonthKeys.has(monthKey)) {
        allocationByMonth.set(monthKey, amount);
      }
    }

    for (const month of months) {
      if (month.isLocked) {
        continue;
      }

      const amount = allocationByMonth.get(month.monthKey) ?? 0;
      const existingExpenses = month.expenses.filter(
        (expense) =>
          expense.annualBudgetItemId === item.id && !expense.isPaid,
      );
      const existingExpense = existingExpenses[0];

      if (amount <= 0) {
        continue;
      }

      const data = {
        name: item.name,
        amount,
        category: "Årssparande",
        expenseType: ExpenseType.ONE_TIME,
        origin: ExpenseOrigin.ANNUAL_SAVING,
        planningType: PlanningType.PLANNED,
        payerType,
        firstPersonSharePercent,
        dueDate: null,
        note: null,
        annualBudgetItemId: item.id,
        updatedByUserId: actorUserId,
      } as const;

      if (existingExpense) {
        retainedExpenseIds.add(existingExpense.id);
        if (
          existingExpense.name !== data.name ||
          existingExpense.amount !== amount ||
          existingExpense.category !== data.category ||
          existingExpense.expenseType !== data.expenseType ||
          existingExpense.payerType !== data.payerType ||
          existingExpense.firstPersonSharePercent !== data.firstPersonSharePercent ||
          existingExpenses.length > 1
        ) {
          await tx.expense.update({
            where: {
              id: existingExpense.id,
            },
            data,
          });
        }
        await tx.annualSavingSchedule.upsert({
          where: {
            budgetMonthId_annualBudgetItemId: {
              budgetMonthId: month.id,
              annualBudgetItemId: item.id,
            },
          },
          create: {
            budgetMonthId: month.id,
            annualBudgetItemId: item.id,
            expenseId: existingExpense.id,
          },
          update: {
            expenseId: existingExpense.id,
          },
        });
      } else {
        const schedule = await tx.annualSavingSchedule.upsert({
          where: {
            budgetMonthId_annualBudgetItemId: {
              budgetMonthId: month.id,
              annualBudgetItemId: item.id,
            },
          },
          create: {
            budgetMonth: {
              connect: {
                id: month.id,
              },
            },
            annualBudgetItem: {
              connect: {
                id: item.id,
              },
            },
            expense: {
              create: {
                name: data.name,
                amount: data.amount,
                category: data.category,
                expenseType: data.expenseType,
                origin: data.origin,
                planningType: data.planningType,
                payerType: data.payerType,
                firstPersonSharePercent: data.firstPersonSharePercent,
                dueDate: data.dueDate,
                note: data.note,
                budgetMonth: {
                  connect: {
                    id: month.id,
                  },
                },
                annualBudgetItem: {
                  connect: {
                    id: item.id,
                  },
                },
                updatedByUser: {
                  connect: {
                    id: actorUserId,
                  },
                },
              },
            },
          },
          update: {
            expense: {
              update: data,
            },
          },
          select: {
            expense: {
              select: {
                id: true,
              },
            },
          },
        });
        retainedExpenseIds.add(schedule.expense.id);
      }
    }
  }

  const staleExpenseIds = months.flatMap((month) =>
    month.isLocked
      ? []
      : month.expenses
          .filter(
            (expense) =>
              !expense.isPaid &&
              (!expense.annualBudgetItemId ||
                !activeItemIds.has(expense.annualBudgetItemId) ||
                !retainedExpenseIds.has(expense.id)),
          )
          .map((expense) => expense.id),
  );

  if (staleExpenseIds.length > 0) {
    await tx.expense.deleteMany({
      where: {
        id: {
          in: staleExpenseIds,
        },
      },
    });
  }
}
