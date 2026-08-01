import { db } from "@/lib/db";
import { householdImportSchema } from "@/lib/validations";
import { syncAutomaticAnnualSavingExpenses } from "@/server/services/annual-saving-expenses";
import { getHouseholdForUser, mapMembersToSlots } from "@/server/services/households";

export async function exportHouseholdDataForUser(userId: string) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    throw new Error("Du behöver ett hushåll innan du kan exportera data.");
  }

  const [months, spendingPaceSettings, spendingPaceEntries, annualBudgetItems] =
    await Promise.all([
      db.budgetMonth.findMany({
        where: {
          householdId: household.id,
        },
        include: {
          personSnapshots: true,
          annualSavingOverrides: {
            select: {
              annualBudgetItemId: true,
            },
          },
          expenses: {
            include: {
              annualBudgetItem: {
                select: {
                  id: true,
                },
              },
            },
          },
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
      db.annualBudgetItem.findMany({
        where: {
          householdId: household.id,
        },
        include: {
          entries: {
            orderBy: {
              createdAt: "asc",
            },
          },
          savingRates: {
            orderBy: {
              startMonth: "asc",
            },
          },
        },
        orderBy: {
          dueMonth: "asc",
        },
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
    annualBudget: annualBudgetItems.map((item) => ({
      backupKey: item.id,
      name: item.name,
      targetAmount: item.targetAmount,
      dueMonth: item.dueMonth,
      category: item.category,
      recurrence: item.recurrence,
      savingMode: item.savingMode,
      savingRates: item.savingRates.map((rate) => ({
        startMonth: rate.startMonth,
        monthlyAmount: rate.monthlyAmount,
      })),
      isArchived: item.isArchived,
      entries: item.entries
        .filter((entry) => !entry.sourceExpenseId)
        .map((entry) => ({
          amount: entry.amount,
          entryType: entry.entryType,
          createdAt: entry.createdAt.toISOString(),
        })),
    })),
    months: months.map((month) => ({
      monthKey: month.monthKey,
      note: month.note,
      isLocked: month.isLocked,
      createdAt: month.createdAt.toISOString(),
      updatedAt: month.updatedAt.toISOString(),
      annualSavingOverrideBackupKeys: month.annualSavingOverrides.map(
        (override) => override.annualBudgetItemId,
      ),
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
        annualBudgetItemBackupKey: expense.annualBudgetItem?.id ?? null,
        swishId: expense.swishId,
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        expenseType: expense.expenseType,
        origin: expense.origin,
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

    const annualBudgetIdByBackupKey = new Map<string, string>();

    if (imported.annualBudget) {
      await tx.annualBudgetItem.deleteMany({
        where: {
          householdId: household.id,
        },
      });

      for (const importedItem of imported.annualBudget) {
        const createdItem = await tx.annualBudgetItem.create({
          data: {
            householdId: household.id,
            name: importedItem.name,
            targetAmount: importedItem.targetAmount,
            dueMonth: importedItem.dueMonth,
            category: importedItem.category,
            recurrence: importedItem.recurrence ?? "ONE_TIME",
            savingMode: importedItem.savingMode ?? "TARGET_BY_DATE",
            isArchived: importedItem.isArchived,
            updatedByUserId: userId,
            entries: {
              create: importedItem.entries.map((entry) => ({
                amount: entry.amount,
                entryType: entry.entryType,
                createdAt: new Date(entry.createdAt),
                updatedByUserId: userId,
              })),
            },
            savingRates: {
              create: (importedItem.savingRates ?? []).map((rate) => ({
                startMonth: rate.startMonth,
                monthlyAmount: rate.monthlyAmount,
                updatedByUserId: userId,
              })),
            },
          },
        });

        if (importedItem.backupKey) {
          annualBudgetIdByBackupKey.set(importedItem.backupKey, createdItem.id);
        }
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
      await tx.annualSavingOverride.deleteMany({
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
        for (const expense of importedMonth.expenses) {
          const annualBudgetItemId = expense.annualBudgetItemBackupKey
            ? annualBudgetIdByBackupKey.get(
                expense.annualBudgetItemBackupKey,
              ) ?? null
            : null;
          const createdExpense = await tx.expense.create({
            data: {
              budgetMonthId: month.id,
              recurringSourceExpenseId:
                expense.recurringSourceExpenseId ?? null,
              annualBudgetItemId,
              swishId: expense.swishId ?? null,
              name: expense.name,
              amount: expense.amount,
              category: expense.category,
              expenseType: expense.expenseType,
              origin: expense.origin ?? "STANDARD",
              planningType: expense.planningType,
              payerType: expense.payerType,
              dueDate: expense.dueDate ? new Date(expense.dueDate) : null,
              isPaid: expense.isPaid,
              paidAt: expense.paidAt ? new Date(expense.paidAt) : null,
              firstPersonPaidAt: expense.firstPersonPaidAt
                ? new Date(expense.firstPersonPaidAt)
                : null,
              secondPersonPaidAt: expense.secondPersonPaidAt
                ? new Date(expense.secondPersonPaidAt)
                : null,
              firstPersonSwishId: expense.firstPersonSwishId ?? null,
              secondPersonSwishId: expense.secondPersonSwishId ?? null,
              note: expense.note,
              updatedByUserId: userId,
            },
          });

          if (annualBudgetItemId && expense.isPaid) {
            await tx.annualSavingEntry.create({
              data: {
                annualBudgetItemId,
                sourceExpenseId: createdExpense.id,
                amount: createdExpense.amount,
                entryType: "CONTRIBUTION",
                updatedByUserId: userId,
              },
            });
          }

          if (
            annualBudgetItemId &&
            expense.origin === "ANNUAL_SAVING"
          ) {
            await tx.annualSavingSchedule.upsert({
              where: {
                budgetMonthId_annualBudgetItemId: {
                  budgetMonthId: month.id,
                  annualBudgetItemId,
                },
              },
              create: {
                budgetMonthId: month.id,
                annualBudgetItemId,
                expenseId: createdExpense.id,
              },
              update: {
                expenseId: createdExpense.id,
              },
            });
          }
        }
      }

      const overrideItemIds = (
        importedMonth.annualSavingOverrideBackupKeys ?? []
      )
        .map((backupKey) => annualBudgetIdByBackupKey.get(backupKey))
        .filter((itemId): itemId is string => Boolean(itemId));

      if (overrideItemIds.length > 0) {
        await tx.annualSavingOverride.createMany({
          data: overrideItemIds.map((annualBudgetItemId) => ({
            budgetMonthId: month.id,
            annualBudgetItemId,
            createdByUserId: userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: household.id,
      actorUserId: userId,
    });
  });
}
