"use server";

import {
  budgetScenarioIdSchema,
  createBudgetScenarioSchema,
  deleteScenarioExpenseSchema,
  promoteBudgetScenarioSchema,
  scenarioExpenseSchema,
  scenarioSnapshotSchema,
  updateBudgetScenarioNoteSchema,
  updateBudgetScenarioSchema,
} from "@/lib/validations";
import { requireUser } from "@/lib/session";
import {
  createBudgetScenarioForUser,
  deleteBudgetScenarioForUser,
  deleteScenarioExpenseForUser,
  duplicateBudgetScenarioForUser,
  promoteBudgetScenarioForUser,
  renameBudgetScenarioForUser,
  updateBudgetScenarioNoteForUser,
  updateScenarioSnapshotForUser,
  upsertScenarioExpenseForUser,
} from "@/server/services/budget-scenarios";

import { redirectWithMessage, revalidateBudgetPaths } from "./shared";

function actionError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function createBudgetScenarioAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createBudgetScenarioSchema.safeParse({
    name: formData.get("name"),
    referenceMonthKey: formData.get("referenceMonthKey"),
    sourceMonthId: formData.get("sourceMonthId"),
  });
  if (!parsed.success) redirectWithMessage("/app/playground", "error", parsed.error.issues[0]?.message ?? "Ogiltig testbudget.");

  let scenarioId = "";
  try {
    const scenario = await createBudgetScenarioForUser({
      actorUserId: user.id,
      name: parsed.data.name,
      referenceMonthKey: parsed.data.referenceMonthKey,
      sourceMonthId: parsed.data.sourceMonthId || null,
    });
    scenarioId = scenario.id;
  } catch (error) {
    redirectWithMessage("/app/playground", "error", actionError(error, "Kunde inte skapa testbudgeten."));
  }
  revalidateBudgetPaths("/app/playground");
  redirectWithMessage(`/app/playground/${scenarioId}`, "notice", "Testbudgeten skapades.");
}

export async function duplicateBudgetScenarioAction(formData: FormData) {
  const user = await requireUser();
  const parsed = budgetScenarioIdSchema.safeParse({ scenarioId: formData.get("scenarioId") });
  if (!parsed.success) redirectWithMessage("/app/playground", "error", "Ogiltig testbudget.");
  let scenarioId = "";
  try {
    scenarioId = (await duplicateBudgetScenarioForUser({ actorUserId: user.id, scenarioId: parsed.data.scenarioId })).id;
  } catch (error) {
    redirectWithMessage("/app/playground", "error", actionError(error, "Kunde inte duplicera testbudgeten."));
  }
  revalidateBudgetPaths("/app/playground");
  redirectWithMessage(`/app/playground/${scenarioId}`, "notice", "Testbudgeten duplicerades.");
}

export async function deleteBudgetScenarioAction(formData: FormData) {
  const user = await requireUser();
  const parsed = budgetScenarioIdSchema.safeParse({ scenarioId: formData.get("scenarioId") });
  const returnTo = String(formData.get("returnTo") || "/app/playground");
  if (!parsed.success) redirectWithMessage(returnTo, "error", "Ogiltig testbudget.");
  try {
    await deleteBudgetScenarioForUser(user.id, parsed.data.scenarioId);
  } catch (error) {
    redirectWithMessage(returnTo, "error", actionError(error, "Kunde inte ta bort testbudgeten."));
  }
  revalidateBudgetPaths("/app/playground");
  redirectWithMessage("/app/playground", "notice", "Testbudgeten togs bort.");
}

export async function renameBudgetScenarioAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/playground");
  const parsed = updateBudgetScenarioSchema.safeParse({ scenarioId: formData.get("scenarioId"), name: formData.get("name") });
  if (!parsed.success) redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Ogiltigt namn.");
  try {
    await renameBudgetScenarioForUser({ actorUserId: user.id, scenarioId: parsed.data.scenarioId, name: parsed.data.name });
  } catch (error) {
    redirectWithMessage(returnTo, "error", actionError(error, "Kunde inte byta namn."));
  }
  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Namnet sparades.");
}

export async function updateBudgetScenarioNoteAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/playground");
  const parsed = updateBudgetScenarioNoteSchema.safeParse({ scenarioId: formData.get("scenarioId"), note: formData.get("note") });
  if (!parsed.success) redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Ogiltig anteckning.");
  try {
    await updateBudgetScenarioNoteForUser({ actorUserId: user.id, scenarioId: parsed.data.scenarioId, note: parsed.data.note });
  } catch (error) {
    redirectWithMessage(returnTo, "error", actionError(error, "Kunde inte spara anteckningen."));
  }
  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Anteckningen sparades.");
}

export async function updateScenarioSnapshotAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/playground");
  const parsed = scenarioSnapshotSchema.safeParse({
    scenarioId: formData.get("scenarioId"), userId: formData.get("userId"),
    incomeAmount: formData.get("incomeAmount"), carryOverAmount: formData.get("carryOverAmount"),
  });
  if (!parsed.success) redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Ogiltiga belopp.");
  try {
    await updateScenarioSnapshotForUser({
      actorUserId: user.id, scenarioId: parsed.data.scenarioId, targetUserId: parsed.data.userId,
      incomeAmount: parsed.data.incomeAmount, carryOverAmount: parsed.data.carryOverAmount,
    });
  } catch (error) {
    redirectWithMessage(returnTo, "error", actionError(error, "Kunde inte spara beloppen."));
  }
  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Beloppen sparades.");
}

export async function saveScenarioExpenseAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/playground");
  const parsed = scenarioExpenseSchema.safeParse({
    scenarioId: formData.get("scenarioId"), expenseId: formData.get("expenseId"), name: formData.get("name"),
    amount: formData.get("amount"), category: formData.get("category"), expenseType: formData.get("expenseType"), payerType: formData.get("payerType"),
  });
  if (!parsed.success) redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Ogiltig utgift.");
  try {
    await upsertScenarioExpenseForUser({ actorUserId: user.id, scenarioId: parsed.data.scenarioId, expenseId: parsed.data.expenseId || null,
      name: parsed.data.name, amount: parsed.data.amount, category: parsed.data.category,
      expenseType: parsed.data.expenseType, payerType: parsed.data.payerType });
  } catch (error) {
    redirectWithMessage(returnTo, "error", actionError(error, "Kunde inte spara utgiften."));
  }
  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Utgiften sparades.");
}

export async function deleteScenarioExpenseAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/playground");
  const parsed = deleteScenarioExpenseSchema.safeParse({ scenarioId: formData.get("scenarioId"), expenseId: formData.get("expenseId") });
  if (!parsed.success) redirectWithMessage(returnTo, "error", "Ogiltig utgift.");
  try {
    await deleteScenarioExpenseForUser({ actorUserId: user.id, scenarioId: parsed.data.scenarioId, expenseId: parsed.data.expenseId });
  } catch (error) {
    redirectWithMessage(returnTo, "error", actionError(error, "Kunde inte ta bort utgiften."));
  }
  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Utgiften togs bort.");
}

export async function promoteBudgetScenarioAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/playground");
  const parsed = promoteBudgetScenarioSchema.safeParse({ scenarioId: formData.get("scenarioId"), targetMonthKey: formData.get("targetMonthKey") });
  if (!parsed.success) redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Ogiltig månad.");
  try {
    await promoteBudgetScenarioForUser({ actorUserId: user.id, scenarioId: parsed.data.scenarioId, targetMonthKey: parsed.data.targetMonthKey });
  } catch (error) {
    redirectWithMessage(returnTo, "error", actionError(error, "Kunde inte skapa månaden."));
  }
  revalidateBudgetPaths("/app/months");
  redirectWithMessage(`/app/months/${parsed.data.targetMonthKey}`, "notice", "Månaden skapades från Playground.");
}
