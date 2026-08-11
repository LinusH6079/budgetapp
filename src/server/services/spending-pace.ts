import { db } from "@/lib/db";
import { calendarDateKey, getPayCycle } from "@/lib/pay-cycle";
import { getHouseholdForUser } from "@/server/services/households";

export async function getSpendingPaceForUser(
  userId: string,
  now = new Date(),
) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    return null;
  }

  const cycle = getPayCycle(now);
  const cycleStartKey = calendarDateKey(cycle.startDate);
  const weekStartKey = calendarDateKey(cycle.weekStartDate);
  const [settings, entries] = await Promise.all([
    db.spendingPaceSettings.findUnique({
      where: {
        householdId: household.id,
      },
    }),
    db.spendingPaceEntry.findMany({
      where: {
        householdId: household.id,
        cycleStartKey,
      },
      orderBy: [
        {
          weekStartKey: "asc",
        },
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
  ]);
  const spent = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const currentWeekEntries = entries.filter(
    (entry) => entry.weekStartKey === weekStartKey,
  );
  const currentWeekAmount = currentWeekEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const weeklyTotals = Object.entries(
    entries.reduce<Record<string, number>>((totals, entry) => {
      totals[entry.weekStartKey] =
        (totals[entry.weekStartKey] ?? 0) + entry.amount;
      return totals;
    }, {}),
  ).map(([entryWeekStartKey, amount]) => ({
    weekStartKey: entryWeekStartKey,
    amount,
  }));

  return {
    settings,
    entries,
    cycle,
    cycleStartKey,
    weekStartKey,
    currentWeekAmount,
    weeklyTotals,
    spent,
    remaining: settings ? settings.monthlyLimit - spent : null,
    weekRemaining: settings
      ? settings.weeklyLimit -
        currentWeekAmount
      : null,
  };
}

export async function saveSpendingPaceSettingsForUser(input: {
  userId: string;
  monthlyLimit: number;
  weeklyLimit: number;
}) {
  const household = await getHouseholdForUser(input.userId);

  if (!household) {
    throw new Error("Hushållet hittades inte.");
  }

  return db.spendingPaceSettings.upsert({
    where: {
      householdId: household.id,
    },
    create: {
      householdId: household.id,
      monthlyLimit: input.monthlyLimit,
      weeklyLimit: input.weeklyLimit,
      updatedByUserId: input.userId,
    },
    update: {
      monthlyLimit: input.monthlyLimit,
      weeklyLimit: input.weeklyLimit,
      updatedByUserId: input.userId,
    },
  });
}

export async function saveCurrentWeekSpendingForUser(input: {
  userId: string;
  amount: number;
  now?: Date;
}) {
  const household = await getHouseholdForUser(input.userId);

  if (!household) {
    throw new Error("Hushållet hittades inte.");
  }

  const cycle = getPayCycle(input.now);
  const cycleStartKey = calendarDateKey(cycle.startDate);
  const weekStartKey = calendarDateKey(cycle.weekStartDate);

  return db.spendingPaceEntry.create({
    data: {
      householdId: household.id,
      cycleStartKey,
      weekStartKey,
      amount: input.amount,
      updatedByUserId: input.userId,
    },
  });
}

export async function deleteSpendingPaceEntryForUser(input: {
  userId: string;
  entryId: string;
}) {
  const household = await getHouseholdForUser(input.userId);

  if (!household) {
    throw new Error("Hushållet hittades inte.");
  }

  const result = await db.spendingPaceEntry.deleteMany({
    where: {
      id: input.entryId,
      householdId: household.id,
    },
  });

  if (result.count === 0) {
    throw new Error("Utgiften hittades inte.");
  }

  return result;
}
