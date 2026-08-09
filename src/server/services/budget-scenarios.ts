import { ExpenseOrigin, PlanningType, Prisma } from "@prisma/client";

import { buildMonthSummary } from "@/lib/budget-calculations";
import {
  editableScenarioExpenses,
  isSystemScenarioOrigin,
  moveScenarioDueDate,
} from "@/lib/budget-scenario";
import { db } from "@/lib/db";
import { syncAutomaticAnnualSavingExpenses } from "@/server/services/annual-saving-expenses";
import { getHouseholdForUser, mapMembersToSlots } from "@/server/services/households";
import { syncLoanExpenses } from "@/server/services/loan-payment-sync";

const scenarioDetailsArgs = {
  include: {
    updatedByUser: true,
    personSnapshots: {
      include: { user: true, updatedByUser: true },
      orderBy: { createdAt: "asc" },
    },
    expenses: {
      include: { updatedByUser: true },
      orderBy: [{ amount: "desc" }, { name: "asc" }],
    },
  },
} satisfies Prisma.BudgetScenarioDefaultArgs;

export type BudgetScenarioWithDetails = Prisma.BudgetScenarioGetPayload<
  typeof scenarioDetailsArgs
>;

function buildScenarioSummary(
  scenario: BudgetScenarioWithDetails,
  members: ReturnType<typeof mapMembersToSlots>,
) {
  const summary = buildMonthSummary({
    monthKey: scenario.referenceMonthKey,
    snapshots: scenario.personSnapshots,
    expenses: scenario.expenses.map((expense) => ({
      ...expense,
      isPaid: false,
      firstPersonPaidAt: null,
      secondPersonPaidAt: null,
    })),
    orderedMembers: members,
  });

  return {
    ...summary,
    remainingPlanned: summary.totalAvailable - summary.totalExpenses,
    perPerson: summary.perPerson.map((person) => ({
      ...person,
      remainingPlanned: person.income + person.carryOver - person.totalExpenses,
    })),
  };
}

async function requireScenarioForUser(userId: string, scenarioId: string) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    throw new Error("Du behöver ett hushåll för att använda Playground.");
  }

  const scenario = await db.budgetScenario.findFirst({
    where: { id: scenarioId, householdId: household.id },
    ...scenarioDetailsArgs,
  });

  if (!scenario) {
    throw new Error("Testbudgeten hittades inte.");
  }

  return { household, scenario };
}

export async function getBudgetScenariosForUser(userId: string) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    return null;
  }

  const scenarios = await db.budgetScenario.findMany({
    where: { householdId: household.id },
    ...scenarioDetailsArgs,
    orderBy: { updatedAt: "desc" },
  });
  const members = mapMembersToSlots(household);

  return {
    household,
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      summary: buildScenarioSummary(scenario, members),
    })),
  };
}

export async function getBudgetScenarioForUser(userId: string, scenarioId: string) {
  const { household, scenario } = await requireScenarioForUser(userId, scenarioId);
  const members = mapMembersToSlots(household);

  return {
    household,
    scenario,
    members,
    summary: buildScenarioSummary(scenario, members),
  };
}

export async function createBudgetScenarioForUser(input: {
  actorUserId: string;
  name: string;
  referenceMonthKey: string;
  sourceMonthId?: string | null;
}) {
  const household = await getHouseholdForUser(input.actorUserId);

  if (!household) {
    throw new Error("Du behöver ett hushåll för att skapa en testbudget.");
  }

  const sourceMonth = input.sourceMonthId
    ? await db.budgetMonth.findFirst({
        where: { id: input.sourceMonthId, householdId: household.id },
        include: { personSnapshots: true, expenses: true },
      })
    : null;

  if (input.sourceMonthId && !sourceMonth) {
    throw new Error("Källmånaden hittades inte i hushållet.");
  }

  const referenceMonthKey = sourceMonth?.monthKey ?? input.referenceMonthKey;

  return db.budgetScenario.create({
    data: {
      householdId: household.id,
      name: input.name,
      referenceMonthKey,
      sourceMonthKey: sourceMonth?.monthKey ?? null,
      note: sourceMonth?.note ?? null,
      updatedByUserId: input.actorUserId,
      personSnapshots: {
        create: household.members.map((member) => {
          const source = sourceMonth?.personSnapshots.find(
            (snapshot) => snapshot.userId === member.userId,
          );
          return {
            userId: member.userId,
            incomeAmount: source?.incomeAmount ?? 0,
            carryOverAmount: source?.carryOverAmount ?? 0,
            updatedByUserId: input.actorUserId,
          };
        }),
      },
      expenses: sourceMonth
        ? {
            create: sourceMonth.expenses.map((expense) => ({
              sourceExpenseId: expense.id,
              name: expense.name,
              amount: expense.amount,
              category: expense.category,
              expenseType: expense.expenseType,
              sourceOrigin: expense.origin,
              planningType: expense.planningType,
              payerType: expense.payerType,
              dueDate: expense.dueDate,
              isSystemGenerated: isSystemScenarioOrigin(expense.origin),
              updatedByUserId: input.actorUserId,
            })),
          }
        : undefined,
    },
  });
}

export async function duplicateBudgetScenarioForUser(input: {
  actorUserId: string;
  scenarioId: string;
}) {
  const { household, scenario } = await requireScenarioForUser(
    input.actorUserId,
    input.scenarioId,
  );

  return db.budgetScenario.create({
    data: {
      householdId: household.id,
      name: `${scenario.name} – kopia`,
      referenceMonthKey: scenario.referenceMonthKey,
      sourceMonthKey: scenario.sourceMonthKey,
      note: scenario.note,
      updatedByUserId: input.actorUserId,
      personSnapshots: {
        create: scenario.personSnapshots.map((snapshot) => ({
          userId: snapshot.userId,
          incomeAmount: snapshot.incomeAmount,
          carryOverAmount: snapshot.carryOverAmount,
          updatedByUserId: input.actorUserId,
        })),
      },
      expenses: {
        create: scenario.expenses.map((expense) => ({
          sourceExpenseId: expense.sourceExpenseId,
          name: expense.name,
          amount: expense.amount,
          category: expense.category,
          expenseType: expense.expenseType,
          sourceOrigin: expense.sourceOrigin,
          planningType: expense.planningType,
          payerType: expense.payerType,
          dueDate: expense.dueDate,
          isSystemGenerated: expense.isSystemGenerated,
          updatedByUserId: input.actorUserId,
        })),
      },
    },
  });
}

export async function renameBudgetScenarioForUser(input: {
  actorUserId: string;
  scenarioId: string;
  name: string;
}) {
  await requireScenarioForUser(input.actorUserId, input.scenarioId);
  return db.budgetScenario.update({
    where: { id: input.scenarioId },
    data: { name: input.name, updatedByUserId: input.actorUserId },
  });
}

export async function updateBudgetScenarioNoteForUser(input: {
  actorUserId: string;
  scenarioId: string;
  note: string;
}) {
  await requireScenarioForUser(input.actorUserId, input.scenarioId);
  return db.budgetScenario.update({
    where: { id: input.scenarioId },
    data: { note: input.note || null, updatedByUserId: input.actorUserId },
  });
}

export async function updateScenarioSnapshotForUser(input: {
  actorUserId: string;
  scenarioId: string;
  targetUserId: string;
  incomeAmount: number;
  carryOverAmount: number;
}) {
  const { household } = await requireScenarioForUser(input.actorUserId, input.scenarioId);

  if (!household.members.some((member) => member.userId === input.targetUserId)) {
    throw new Error("Personen tillhör inte hushållet.");
  }

  const snapshot = await db.scenarioPersonSnapshot.upsert({
    where: {
      budgetScenarioId_userId: {
        budgetScenarioId: input.scenarioId,
        userId: input.targetUserId,
      },
    },
    create: {
      budgetScenarioId: input.scenarioId,
      userId: input.targetUserId,
      incomeAmount: input.incomeAmount,
      carryOverAmount: input.carryOverAmount,
      updatedByUserId: input.actorUserId,
    },
    update: {
      incomeAmount: input.incomeAmount,
      carryOverAmount: input.carryOverAmount,
      updatedByUserId: input.actorUserId,
    },
  });
  await db.budgetScenario.update({
    where: { id: input.scenarioId },
    data: { updatedByUserId: input.actorUserId },
  });
  return snapshot;
}

export async function upsertScenarioExpenseForUser(input: {
  actorUserId: string;
  scenarioId: string;
  expenseId?: string | null;
  name: string;
  amount: number;
  category: string;
  expenseType: "RECURRING" | "ONE_TIME";
  payerType: "FIRST_PERSON" | "SECOND_PERSON" | "SHARED";
}) {
  await requireScenarioForUser(input.actorUserId, input.scenarioId);

  if (input.expenseId) {
    const existing = await db.scenarioExpense.findFirst({
      where: { id: input.expenseId, budgetScenarioId: input.scenarioId },
    });
    if (!existing) throw new Error("Utgiften hittades inte.");

    const expense = await db.scenarioExpense.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        amount: input.amount,
        category: input.category,
        expenseType: input.expenseType,
        payerType: input.payerType,
        updatedByUserId: input.actorUserId,
      },
    });
    await db.budgetScenario.update({
      where: { id: input.scenarioId },
      data: { updatedByUserId: input.actorUserId },
    });
    return expense;
  }

  const expense = await db.scenarioExpense.create({
    data: {
      budgetScenarioId: input.scenarioId,
      name: input.name,
      amount: input.amount,
      category: input.category,
      expenseType: input.expenseType,
      sourceOrigin: ExpenseOrigin.STANDARD,
      planningType: PlanningType.PLANNED,
      payerType: input.payerType,
      updatedByUserId: input.actorUserId,
    },
  });
  await db.budgetScenario.update({
    where: { id: input.scenarioId },
    data: { updatedByUserId: input.actorUserId },
  });
  return expense;
}

export async function deleteScenarioExpenseForUser(input: {
  actorUserId: string;
  scenarioId: string;
  expenseId: string;
}) {
  await requireScenarioForUser(input.actorUserId, input.scenarioId);
  const expense = await db.scenarioExpense.findFirst({
    where: { id: input.expenseId, budgetScenarioId: input.scenarioId },
  });
  if (!expense) throw new Error("Utgiften hittades inte.");
  const deleted = await db.scenarioExpense.delete({ where: { id: expense.id } });
  await db.budgetScenario.update({
    where: { id: input.scenarioId },
    data: { updatedByUserId: input.actorUserId },
  });
  return deleted;
}

export async function deleteBudgetScenarioForUser(userId: string, scenarioId: string) {
  await requireScenarioForUser(userId, scenarioId);
  return db.budgetScenario.delete({ where: { id: scenarioId } });
}

export async function promoteBudgetScenarioForUser(input: {
  actorUserId: string;
  scenarioId: string;
  targetMonthKey: string;
}) {
  const { household, scenario } = await requireScenarioForUser(
    input.actorUserId,
    input.scenarioId,
  );

  return db.$transaction(
    async (tx) => {
      const existing = await tx.budgetMonth.findUnique({
      where: {
        householdId_monthKey: {
          householdId: household.id,
          monthKey: input.targetMonthKey,
        },
      },
    });
    if (existing) throw new Error("Den riktiga månaden finns redan.");

    const month = await tx.budgetMonth.create({
      data: {
        householdId: household.id,
        monthKey: input.targetMonthKey,
        note: scenario.note,
        updatedByUserId: input.actorUserId,
        personSnapshots: {
          create: scenario.personSnapshots.map((snapshot) => ({
            userId: snapshot.userId,
            incomeAmount: snapshot.incomeAmount,
            carryOverAmount: snapshot.carryOverAmount,
            updatedByUserId: input.actorUserId,
          })),
        },
        expenses: {
          create: editableScenarioExpenses(scenario.expenses)
            .map((expense) => ({
              name: expense.name,
              amount: expense.amount,
              category: expense.category,
              expenseType: expense.expenseType,
              origin: ExpenseOrigin.STANDARD,
              planningType: expense.planningType,
              payerType: expense.payerType,
              dueDate: moveScenarioDueDate(expense.dueDate, input.targetMonthKey),
              updatedByUserId: input.actorUserId,
            })),
        },
      },
    });

    await syncAutomaticAnnualSavingExpenses({
      tx,
      householdId: household.id,
      actorUserId: input.actorUserId,
    });
    await syncLoanExpenses({
      tx,
      householdId: household.id,
      actorUserId: input.actorUserId,
    });

      return month;
    },
    {
      maxWait: 5_000,
      timeout: 20_000,
    },
  );
}
