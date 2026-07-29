import { db } from "@/lib/db";
import { householdImportSchema } from "@/lib/validations";
import { getHouseholdForUser, mapMembersToSlots } from "@/server/services/households";

export async function exportHouseholdDataForUser(userId: string) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan exportera data.");
  }

  const [months, spendingPaceSettings, spendingPaceEntries] =
    await Promise.all([
      db.budgetMonth.findMany({
        where: {
          householdId: household.id,
        },
        include: {
          personSnapshots: true,
          expenses: true,
        },
        orderBy: {
          monthKey: "asc",
        },
      }),
      db.spendingPaceSettings.findUnique({
        where: {
          householdId: household.id,
        },
      }),
      db.spendingPaceEntry.findMany({
        where: {
          householdId: household.id,
        },
        orderBy: [
          {
            cycleStartKey: "asc",
          },
          {
            weekStartKey: "asc",
          },
        ],
      }),
    ]);

  const members = mapMembersToSlots(household);

  return {
    version: 1 as const,
    householdName: household.name,
    exportedAt: new Date().toISOString(),
    members: members.map((member) => ({
      slot: member.slot,
      name: member.name,
      email: member.email,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
    spendingPace: {
      settings: spendingPaceSettings
        ? {
            monthlyLimit: spendingPaceSettings.monthlyLimit,
            weeklyLimit: spendingPaceSettings.weeklyLimit,
          }
        : null,
      entries: spendingPaceEntries.map((entry) => ({
        cycleStartKey: entry.cycleStartKey,
        weekStartKey: entry.weekStartKey,
        amount: entry.amount,
      })),
    },
    months: months.map((month) => ({
      monthKey: month.monthKey,
      note: month.note,
      isLocked: month.isLocked,
      createdAt: month.createdAt.toISOString(),
      updatedAt: month.updatedAt.toISOString(),
      snapshots: month.personSnapshots.map((snapshot) => {
        const member = members.find((current) => current.userId === snapshot.userId);
        return {
          slot: member?.slot ?? "FIRST_PERSON",
          incomeAmount: snapshot.incomeAmount,
          carryOverAmount: snapshot.carryOverAmount,
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString(),
        };
      }),
      expenses: month.expenses.map((expense) => ({
        recurringSourceExpenseId: expense.recurringSourceExpenseId,
        swishId: expense.swishId,
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        expenseType: expense.expenseType,
        planningType: expense.planningType,
        payerType: expense.payerType,
        dueDate: expense.dueDate?.toISOString() ?? null,
        isPaid: expense.isPaid,
        paidAt: expense.paidAt?.toISOString() ?? null,
        firstPersonPaidAt: expense.firstPersonPaidAt?.toISOString() ?? null,
        secondPersonPaidAt: expense.secondPersonPaidAt?.toISOString() ?? null,
        firstPersonSwishId: expense.firstPersonSwishId,
        secondPersonSwishId: expense.secondPersonSwishId,
        note: expense.note,
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString(),
      })),
    })),
  };
}

export async function importHouseholdDataForUser(userId: string, rawJson: string) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan importera data.");
  }

  const parsedJson = JSON.parse(rawJson) as unknown;
  const imported = householdImportSchema.parse(parsedJson);
  const members = mapMembersToSlots(household);

  if (imported.members.length > members.length) {
    throw new Error("Nuvarande hushåll har för få medlemmar för att ta emot den här backupen.");
  }

  const slotToUserId = new Map(members.map((member) => [member.slot, member.userId]));

  await db.$transaction(async (tx) => {
    await tx.household.update({
      where: {
        id: household.id,
      },
      data: {
        name: imported.householdName,
      },
    });

    if (imported.spendingPace) {
      if (imported.spendingPace.settings) {
        await tx.spendingPaceSettings.upsert({
          where: {
            householdId: household.id,
          },
          create: {
            householdId: household.id,
            monthlyLimit: imported.spendingPace.settings.monthlyLimit,
            weeklyLimit: imported.spendingPace.settings.weeklyLimit,
            updatedByUserId: userId,
          },
          update: {
            monthlyLimit: imported.spendingPace.settings.monthlyLimit,
            weeklyLimit: imported.spendingPace.settings.weeklyLimit,
            updatedByUserId: userId,
          },
        });
      } else {
        await tx.spendingPaceSettings.deleteMany({
          where: {
            householdId: household.id,
          },
        });
      }

      await tx.spendingPaceEntry.deleteMany({
        where: {
          householdId: household.id,
        },
      });

      if (imported.spendingPace.entries.length > 0) {
        await tx.spendingPaceEntry.createMany({
          data: imported.spendingPace.entries.map((entry) => ({
            householdId: household.id,
            cycleStartKey: entry.cycleStartKey,
            weekStartKey: entry.weekStartKey,
            amount: entry.amount,
            updatedByUserId: userId,
          })),
        });
      }
    }

    for (const importedMonth of imported.months) {
      const month = await tx.budgetMonth.upsert({
        where: {
          householdId_monthKey: {
            householdId: household.id,
            monthKey: importedMonth.monthKey,
          },
        },
        create: {
          householdId: household.id,
          monthKey: importedMonth.monthKey,
          note: importedMonth.note,
          isLocked: importedMonth.isLocked,
          updatedByUserId: userId,
        },
        update: {
          note: importedMonth.note,
          isLocked: importedMonth.isLocked,
          updatedByUserId: userId,
        },
      });

      await tx.expense.deleteMany({
        where: {
          budgetMonthId: month.id,
        },
      });

      for (const snapshot of importedMonth.snapshots) {
        const targetUserId = slotToUserId.get(snapshot.slot);

        if (!targetUserId) {
          continue;
        }

        await tx.monthlyPersonSnapshot.upsert({
          where: {
            budgetMonthId_userId: {
              budgetMonthId: month.id,
              userId: targetUserId,
            },
          },
          create: {
            budgetMonthId: month.id,
            userId: targetUserId,
            incomeAmount: snapshot.incomeAmount,
            carryOverAmount: snapshot.carryOverAmount,
            updatedByUserId: userId,
          },
          update: {
            incomeAmount: snapshot.incomeAmount,
            carryOverAmount: snapshot.carryOverAmount,
            updatedByUserId: userId,
          },
        });
      }

      if (importedMonth.expenses.length > 0) {
        await tx.expense.createMany({
          data: importedMonth.expenses.map((expense) => ({
            budgetMonthId: month.id,
            recurringSourceExpenseId: expense.recurringSourceExpenseId ?? null,
            swishId: expense.swishId ?? null,
            name: expense.name,
            amount: expense.amount,
            category: expense.category,
            expenseType: expense.expenseType,
            planningType: expense.planningType,
            payerType: expense.payerType,
            dueDate: expense.dueDate ? new Date(expense.dueDate) : null,
            isPaid: expense.isPaid,
            paidAt: expense.paidAt ? new Date(expense.paidAt) : null,
            firstPersonPaidAt: expense.firstPersonPaidAt ? new Date(expense.firstPersonPaidAt) : null,
            secondPersonPaidAt: expense.secondPersonPaidAt ? new Date(expense.secondPersonPaidAt) : null,
            firstPersonSwishId: expense.firstPersonSwishId ?? null,
            secondPersonSwishId: expense.secondPersonSwishId ?? null,
            note: expense.note,
            updatedByUserId: userId,
          })),
        });
      }
    }
  });
}
