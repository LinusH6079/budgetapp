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
      orderBy: {
        weekStartKey: "asc",
      },
    }),
  ]);
  const spent = entries.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    settings,
    entries,
    cycle,
    cycleStartKey,
    weekStartKey,
    currentWeekAmount:
      entries.find((entry) => entry.weekStartKey === weekStartKey)?.amount ?? 0,
    spent,
    remaining: settings ? settings.monthlyLimit - spent : null,
    weekRemaining: settings
      ? settings.weeklyLimit -
        (entries.find((entry) => entry.weekStartKey === weekStartKey)?.amount ??
          0)
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

  return db.spendingPaceEntry.upsert({
    where: {
      householdId_cycleStartKey_weekStartKey: {
        householdId: household.id,
        cycleStartKey,
        weekStartKey,
      },
    },
    create: {
      householdId: household.id,
      cycleStartKey,
      weekStartKey,
      amount: input.amount,
      updatedByUserId: input.userId,
    },
    update: {
      amount: input.amount,
      updatedByUserId: input.userId,
    },
  });
}
