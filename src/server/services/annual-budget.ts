import {
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
  const calculation = calculateAnnualBudget(items, now);
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
            entry.entryType === AnnualSavingEntryType.CONTRIBUTION,
        );

      return {
        ...source,
        ...calculated,
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
  dueMonth: string;
  category: string;
}) {
  const household = await getHouseholdForUser(input.actorUserId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan skapa en årskostnad.");
  }

  const data = {
    name: input.name,
    targetAmount: input.targetAmount,
    dueMonth: input.dueMonth,
    category: input.category || null,
    updatedByUserId: input.actorUserId,
  };

  if (!input.itemId) {
    return db.annualBudgetItem.create({
      data: {
        householdId: household.id,
        ...data,
      },
    });
  }

  const item = await requireAnnualItemAccess(
    input.actorUserId,
    input.itemId,
  );

  if (item.isArchived) {
    throw new Error("En avslutad årskostnad kan inte ändras.");
  }

  return db.annualBudgetItem.update({
    where: {
      id: item.id,
    },
    data,
  });
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

    return entry;
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

  return db.annualBudgetItem.update({
    where: {
      id: item.id,
    },
    data: {
      isArchived: true,
      updatedByUserId: input.actorUserId,
    },
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

    await tx.annualBudgetItem.update({
      where: {
        id: item.id,
      },
      data: {
        isArchived: true,
        updatedByUserId: input.actorUserId,
      },
    });

    return expense;
  });
}
