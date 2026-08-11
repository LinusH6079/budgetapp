"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  spendingPaceEntryDeleteSchema,
  spendingPaceEntrySchema,
  spendingPaceSettingsSchema,
} from "@/lib/validations";
import {
  deleteSpendingPaceEntryForUser,
  saveCurrentWeekSpendingForUser,
  saveSpendingPaceSettingsForUser,
} from "@/server/services/spending-pace";

import { redirectWithMessage } from "./shared";

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

  revalidatePath("/app");
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

  revalidatePath("/app");
  redirectWithMessage("/app", "notice", "Beloppet lades till på veckan.");
}

export async function deleteSpendingPaceEntryAction(input: {
  entryId: string;
}) {
  const user = await requireUser();
  const parsed = spendingPaceEntryDeleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      message: "Kunde inte ta bort utgiften.",
    };
  }

  try {
    await deleteSpendingPaceEntryForUser({
      userId: user.id,
      entryId: parsed.data.entryId,
    });
    revalidatePath("/app");

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error ? error.message : "Kunde inte ta bort utgiften.",
    };
  }
}
