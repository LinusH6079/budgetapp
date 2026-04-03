"use server";

import {
  createMonthSchema,
  snapshotValueSchema,
  toggleMonthLockSchema,
  updateMonthNoteSchema,
} from "@/lib/validations";
import { requireUser } from "@/lib/session";
import {
  createMonthForUser,
  createNextMonthForUser,
  toggleMonthLockForUser,
  updateMonthNoteForUser,
  updateSnapshotValuesForUser,
} from "@/server/services/budget-months";

import { redirectWithMessage, revalidateBudgetPaths } from "./shared";

export async function createMonthAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/months");
  const parsed = createMonthSchema.safeParse({
    monthKey: formData.get("monthKey"),
    copyRecurringFromMonthId: formData.get("copyRecurringFromMonthId"),
  });

  if (!parsed.success) {
    redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Ogiltig månad.");
  }

  try {
    await createMonthForUser({
      userId: user.id,
      monthKey: parsed.data.monthKey,
      copyRecurringFromMonthId: parsed.data.copyRecurringFromMonthId || null,
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Kunde inte skapa månad.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(`/app/months/${parsed.data.monthKey}`, "notice", "Månaden skapades.");
}

export async function createNextMonthAction(formData: FormData) {
  const user = await requireUser();
  const currentMonthKey = String(formData.get("currentMonthKey") || "");

  try {
    const month = await createNextMonthForUser(user.id, currentMonthKey);
    revalidateBudgetPaths(`/app/months/${currentMonthKey}`);
    redirectWithMessage(`/app/months/${month.monthKey}`, "notice", "Nästa månad skapades.");
  } catch (error) {
    redirectWithMessage(
      `/app/months/${currentMonthKey}`,
      "error",
      error instanceof Error ? error.message : "Kunde inte skapa nästa månad.",
    );
  }
}

export async function updateSnapshotAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app");
  const parsed = snapshotValueSchema.safeParse({
    monthId: formData.get("monthId"),
    userId: formData.get("userId"),
    incomeAmount: formData.get("incomeAmount"),
    carryOverAmount: formData.get("carryOverAmount"),
  });

  if (!parsed.success) {
    redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Ogiltiga månadsvärden.");
  }

  try {
    await updateSnapshotValuesForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      targetUserId: parsed.data.userId,
      incomeAmount: parsed.data.incomeAmount,
      carryOverAmount: parsed.data.carryOverAmount,
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Kunde inte spara månadsvärden.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Månadsvärdena sparades.");
}

export async function updateMonthNoteAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app");
  const parsed = updateMonthNoteSchema.safeParse({
    monthId: formData.get("monthId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Anteckningen är ogiltig.");
  }

  try {
    await updateMonthNoteForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      note: parsed.data.note,
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Kunde inte spara anteckningen.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Anteckningen sparades.");
}

export async function toggleMonthLockAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app");
  const parsed = toggleMonthLockSchema.safeParse({
    monthId: formData.get("monthId"),
    nextLockedState: formData.get("nextLockedState"),
  });

  if (!parsed.success) {
    redirectWithMessage(returnTo, "error", "Kunde inte ändra låsstatus.");
  }

  try {
    await toggleMonthLockForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      nextLockedState: parsed.data.nextLockedState,
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Kunde inte ändra låsstatus.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(
    returnTo,
    "notice",
    parsed.data.nextLockedState === "lock" ? "Månaden låstes." : "Månaden låstes upp.",
  );
}
