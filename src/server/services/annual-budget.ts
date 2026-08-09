import {
  AnnualBudgetRecurrence,
  AnnualSavingMode,
  AnnualSavingEntryType,
  ExpenseType,
  PayerType,
  PlanningType,
} from "@prisma/client";

import {
  calculateAnnualBudget,
  netReservedAmount,
} from "@/lib/annual-budget-calculations";
import { db } from "@/lib/db";
import { assertMonthEditable } from "@/server/services/access";
import { syncAutomaticAnnualSavingExpenses } from "@/server/services/annual-saving-expenses";
import { getHouseholdForUser } from "@/server/services/households";

function stockholmMonthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month") =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}`;
}

function nextYearDueMonth(monthKey: string, now: Date) {
  const [year, month] = monthKey.split("-");
  let nextYear = Number(year) + 1;

  while (`${nextYear}-${month}` <= stockholmMonthKey(now)) {
    nextYear += 1;
  }

  return `${nextYear}-${month}`;
}

function shiftMonthKeyByYears(monthKey: string, years: number) {
  const [year, month] = monthKey.split("-");
  return `${Number(year) + years}-${month}`;
}

async function requireAnnualItemAccess(actorUserId: string, itemId: string) {
  const item = await db.annualBudgetItem.findFirst({
    where: {
      id: itemId,
      household: {
        members: {
          some: {
            userId: actorUserId,
          },
        },
      },
    },
    include: {
      entries: {
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
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

  if (!item) {
    throw new Error("Årskostnaden hittades inte.");
  }

  return item;
}

export async function getAnnualBudgetForUser(
  userId: string,
  now = new Date(),
) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    return null;
  }

  await db.$transaction(
    (tx) =>
      syncAutomaticAnnualSavingExpenses({
        tx,
        householdId: household.id,
        actorUserId: userId,
        now,
      }),
    { maxWait: 5_000, timeout: 20_000 },
  );

  const items = await db.annualBudgetItem.findMany({
    where: {
      householdId: household.id,
      isArchived: false,
    },
    include: {
      entries: {
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
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
      updatedByUser: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { dueMonth: "asc" },
      { name: "asc" },
    ],
  });
  const calculation = calculateAnnualBudget(
    items.map((item) => ({
      ...item,
      excludedMonthKeys: item.savingOverrides.map(
        (override) => override.budgetMonth.monthKey,
      ),
    })),
    now,
  );
  const activeMonthKey = stockholmMonthKey(now);
  const contributedThisMonth = items.reduce(
    (total, item) =>
      total +
      item.entries.reduce(
        (sum, entry) =>
          sum +
          (entry.entryType === AnnualSavingEntryType.CONTRIBUTION &&
          stockholmMonthKey(entry.createdAt) === activeMonthKey
            ? entry.amount
            : 0),
        0,
      ),
    0,
  );

  return {
    ...calculation,
    contributedThisMonth,
    remainingRecommendedThisMonth: Math.max(
      0,
      calculation.recommendedThisMonth - contributedThisMonth,
    ),
    items: calculation.items.map((calculated) => {
      const source = items.find((item) => item.id === calculated.id)!;
      const latestContribution = [...source.entries]
        .reverse()
        .find(
          (entry) =>
            entry.entryType === AnnualSavingEntryType.CONTRIBUTION &&
            !entry.sourceExpenseId,
        );

      return {
        ...source,
        ...calculated,
        savingRates: source.savingRates,
        latestContribution: latestContribution
          ? {
              id: latestContribution.id,
              amount: latestContribution.amount,
            }
          : null,
      };
    }),
  };
}

export async function upsertAnnualBudgetItemForUser(input: {
  actorUserId: string;
  itemId?: string | null;
  name: string;
  targetAmount: number;
  savingStartMonth: string;
  dueMonth: string;
  category: string;
  recurrence: AnnualBudgetRecurrence;
  savingMode: AnnualSavingMode;
  firstPersonSharePercent: number;
  initialSavingMonth?: string | null;
  initialSavingEndMonth?: string | null;
  initialMonthlyAmount?: number | null;
}) {
  const household = await getHouseholdForUser(input.actorUserId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan skapa en årskostnad.");
  }

  const data = {
    name: input.name,
    targetAmount: input.targetAmount,
    savingStartMonth: input.savingStartMonth,
    dueMonth: input.dueMonth,
    category: input.category || null,
    recurrence: input.recurrence,
    savingMode: input.savingMode,
    firstPersonSharePercent: input.firstPersonSharePercent,
    updatedByUserId: input.actorUserId,
  };

  if (!input.itemId) {
    return db.$transaction(async (tx) => {
      const createdItem = await tx.annualBudgetItem.create({
        data: {
          householdId: household.id,
          ...data,
        },
      });
      if (
        input.savingMode === AnnualSavingMode.CUSTOM_SCHEDULE &&
        input.initialSavingMonth &&
        input.initialMonthlyAmount
      ) {
        await tx.annualSavingRate.create({
          data: {
            annualBudgetItemId: createdItem.id,
            startMonth: input.initialSavingMonth,
            endMonth: input.initialSavingEndMonth ?? null,
            monthlyAmount: input.initialMonthlyAmount,
            updatedByUserId: input.actorUserId,
          },
        });
      }
      await syncAutomaticAnnualSavingExpenses({
        tx,
        householdId: household.id,
        actorUserId: input.actorUserId,
      });
      return createdItem;
    }, { maxWait: 5_000, timeout: 20_000 });
  }

  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );

  if (item.isArchived) {
    throw new Error("En avslutad årskostnad kan inte ändras.");
  }

  return db.$transaction(async (tx) => {
    const updatedItem = await tx.annualBudgetItem.update({
      where: {
        id: item.id,
      },
      data,
    });
    if (
      input.savingMode === AnnualSavingMode.CUSTOM_SCHEDULE &&
      input.initialSavingMonth &&
      input.initialMonthlyAmount
    ) {
      await tx.annualSavingRate.upsert({
        where: {
          annualBudgetItemId_startMonth: {
            annualBudgetItemId: item.id,
            startMonth: input.initialSavingMonth,
          },
        },
        create: {
          annualBudgetItemId: item.id,
          startMonth: input.initialSavingMonth,
          endMonth: input.initialSavingEndMonth ?? null,
          monthlyAmount: input.initialMonthlyAmount,
          updatedByUserId: input.actorUserId,
        },
        update: {
          monthlyAmount: input.initialMonthlyAmount,
          endMonth: input.initialSavingEndMonth ?? null,
          updatedByUserId: input.actorUserId,
        },
      });
    }
    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: item.householdId,
      actorUserId: input.actorUserId,
    });
    return updatedItem;
  }, { maxWait: 5_000, timeout: 20_000 });
}

export async function addAnnualContributionForUser(input: {
  actorUserId: string;
  itemId: string;
  amount: number;
}) {
  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );

  if (item.isArchived) {
    throw new Error("Årskostnaden är avslutad.");
  }

  return db.$transaction(async (tx) => {
    const entry = await tx.annualSavingEntry.create({
      data: {
        annualBudgetItemId: item.id,
        amount: input.amount,
        entryType: AnnualSavingEntryType.CONTRIBUTION,
        updatedByUserId: input.actorUserId,
      },
    });

    await tx.annualBudgetItem.update({
      where: {
        id: item.id,
      },
      data: {
        updatedByUserId: input.actorUserId,
      },
    });

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: item.householdId,
      actorUserId: input.actorUserId,
    });

    return entry;
  });
}

export async function upsertAnnualSavingRateForUser(input: {
  actorUserId: string;
  itemId: string;
  startMonth: string;
  endMonth?: string | null;
  monthlyAmount: number;
}) {
  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );

  if (item.isArchived) {
    throw new Error("En avslutad årskostnad kan inte ändras.");
  }

  if (input.startMonth < item.dueMonth && !input.endMonth) {
    throw new Error(
      "Ange när det tillfälliga beloppet ska sluta så att målet kan räknas om.",
    );
  }

  return db.$transaction(async (tx) => {
    const rate = await tx.annualSavingRate.upsert({
      where: {
        annualBudgetItemId_startMonth: {
          annualBudgetItemId: item.id,
          startMonth: input.startMonth,
        },
      },
      create: {
        annualBudgetItemId: item.id,
        startMonth: input.startMonth,
        endMonth: input.endMonth ?? null,
        monthlyAmount: input.monthlyAmount,
        updatedByUserId: input.actorUserId,
      },
      update: {
        monthlyAmount: input.monthlyAmount,
        endMonth: input.endMonth ?? null,
        updatedByUserId: input.actorUserId,
      },
    });

    await tx.annualBudgetItem.update({
      where: {
        id: item.id,
      },
      data: {
        savingMode: AnnualSavingMode.CUSTOM_SCHEDULE,
        updatedByUserId: input.actorUserId,
      },
    });
    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: item.householdId,
      actorUserId: input.actorUserId,
    });

    return rate;
  });
}

export async function deleteAnnualSavingRateForUser(input: {
  actorUserId: string;
  itemId: string;
  rateId: string;
}) {
  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );

  return db.$transaction(async (tx) => {
    const deleted = await tx.annualSavingRate.deleteMany({
      where: {
        id: input.rateId,
        annualBudgetItemId: item.id,
      },
    });

    if (deleted.count === 0) {
      throw new Error("Sparsteget hittades inte.");
    }

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: item.householdId,
      actorUserId: input.actorUserId,
    });

    return deleted;
  });
}

export async function undoLatestAnnualContributionForUser(input: {
  actorUserId: string;
  itemId: string;
}) {
  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );
  const latestContribution = await db.annualSavingEntry.findFirst({
    where: {
      annualBudgetItemId: item.id,
      entryType: AnnualSavingEntryType.CONTRIBUTION,
      sourceExpenseId: null,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });

  if (!latestContribution) {
    throw new Error("Det finns ingen insättning att ångra.");
  }

  return db.$transaction(async (tx) => {
    const entry = await tx.annualSavingEntry.delete({
      where: {
        id: latestContribution.id,
      },
    });

    await tx.annualBudgetItem.update({
      where: {
        id: item.id,
      },
      data: {
        updatedByUserId: input.actorUserId,
      },
    });

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: item.householdId,
      actorUserId: input.actorUserId,
    });

    return entry;
  });
}

export async function archiveAnnualBudgetItemForUser(input: {
  actorUserId: string;
  itemId: string;
}) {
  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );

  return db.$transaction(async (tx) => {
    const archivedItem = await tx.annualBudgetItem.update({
      where: {
        id: item.id,
      },
      data: {
        isArchived: true,
        updatedByUserId: input.actorUserId,
      },
    });
    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: item.householdId,
      actorUserId: input.actorUserId,
    });
    return archivedItem;
  });
}

export async function settleAnnualBudgetItemForUser(input: {
  actorUserId: string;
  itemId: string;
  monthId: string;
  amount: number;
  payerType: PayerType;
}) {
  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );

  if (item.isArchived) {
    throw new Error("Årskostnaden är redan avslutad.");
  }

  const month = await db.budgetMonth.findFirst({
    where: {
      id: input.monthId,
      householdId: item.householdId,
    },
  });

  if (!month) {
    throw new Error("Månaden hittades inte.");
  }

  assertMonthEditable(month.isLocked);

  if (
    input.payerType !== PayerType.FIRST_PERSON &&
    item.household.members.length < 2
  ) {
    throw new Error("Den andra personen har inte gått med i hushållet ännu.");
  }

  const paidAt = new Date();
  const reservedAmount = netReservedAmount(item.entries);

  return db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        budgetMonthId: month.id,
        name: item.name,
        amount: input.amount,
        category: item.category || "Årskostnad",
        expenseType: ExpenseType.ONE_TIME,
        planningType: PlanningType.PLANNED,
        payerType: input.payerType,
        isPaid: true,
        paidAt,
        firstPersonPaidAt:
          input.payerType === PayerType.SECOND_PERSON ? null : paidAt,
        secondPersonPaidAt:
          input.payerType === PayerType.FIRST_PERSON ? null : paidAt,
        updatedByUserId: input.actorUserId,
      },
    });

    if (reservedAmount > 0) {
      await tx.annualSavingEntry.create({
        data: {
          annualBudgetItemId: item.id,
          amount: reservedAmount,
          entryType: AnnualSavingEntryType.WITHDRAWAL,
          updatedByUserId: input.actorUserId,
        },
      });
    }

    const isYearly = item.recurrence === AnnualBudgetRecurrence.YEARLY;
    const nextDueMonth = isYearly
      ? nextYearDueMonth(item.dueMonth, paidAt)
      : item.dueMonth;
    const dueYearShift =
      Number(nextDueMonth.slice(0, 4)) - Number(item.dueMonth.slice(0, 4));
    await tx.annualBudgetItem.update({
      where: {
        id: item.id,
      },
      data: {
        isArchived: !isYearly,
        savingStartMonth:
          isYearly && item.savingStartMonth
            ? shiftMonthKeyByYears(item.savingStartMonth, dueYearShift)
            : item.savingStartMonth,
        dueMonth: nextDueMonth,
        updatedByUserId: input.actorUserId,
      },
    });

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: item.householdId,
      actorUserId: input.actorUserId,
    });

    return expense;
  });
}
