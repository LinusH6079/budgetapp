"use server";

import { requireUser } from "@/lib/session";
import {
  spendingPaceEntrySchema,
  spendingPaceSettingsSchema,
} from "@/lib/validations";
import {
  saveCurrentWeekSpendingForUser,
  saveSpendingPaceSettingsForUser,
  undoLatestCurrentWeekSpendingForUser,
} from "@/server/services/spending-pace";

import { redirectWithMessage, revalidateBudgetPaths } from "./shared";

export async function saveSpendingPaceSettingsAction(formData: FormData) {
  const user = await requireUser();
  const parsed = spendingPaceSettingsSchema.safeParse({
    monthlyLimit: formData.get("monthlyLimit"),
    weeklyLimit: formData.get("weeklyLimit"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/app",
      "error",
      parsed.error.issues[0]?.message ?? "Inställningen är ogiltig.",
    );
  }

  try {
    await saveSpendingPaceSettingsForUser({
      userId: user.id,
      monthlyLimit: parsed.data.monthlyLimit,
      weeklyLimit: parsed.data.weeklyLimit,
    });
  } catch (error) {
    redirectWithMessage(
      "/app",
      "error",
      error instanceof Error ? error.message : "Kunde inte spara inställningen.",
    );
  }

  revalidateBudgetPaths("/app");
  redirectWithMessage("/app", "notice", "Lönebudgeten sparades.");
}

export async function saveCurrentWeekSpendingAction(formData: FormData) {
  const user = await requireUser();
  const parsed = spendingPaceEntrySchema.safeParse({
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/app",
      "error",
      parsed.error.issues[0]?.message ?? "Veckobeloppet är ogiltigt.",
    );
  }

  try {
    await saveCurrentWeekSpendingForUser({
      userId: user.id,
      amount: parsed.data.amount,
    });
  } catch (error) {
    redirectWithMessage(
      "/app",
      "error",
      error instanceof Error ? error.message : "Kunde inte spara veckobeloppet.",
    );
  }

  revalidateBudgetPaths("/app");
  redirectWithMessage("/app", "notice", "Beloppet lades till på veckan.");
}

export async function undoLatestCurrentWeekSpendingAction() {
  const user = await requireUser();

  try {
    await undoLatestCurrentWeekSpendingForUser({
      userId: user.id,
    });
  } catch (error) {
    redirectWithMessage(
      "/app",
      "error",
      error instanceof Error ? error.message : "Kunde inte ångra beloppet.",
    );
  }

  revalidateBudgetPaths("/app");
  redirectWithMessage("/app", "notice", "Senaste veckobeloppet ångrades.");
}
