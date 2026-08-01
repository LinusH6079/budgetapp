"use server";

import { requireUser } from "@/lib/session";
import {
  annualBudgetItemSchema,
  annualContributionSchema,
  annualSavingRateSchema,
  deleteAnnualSavingRateSchema,
  annualItemIdSchema,
  settleAnnualBudgetItemSchema,
} from "@/lib/validations";
import {
  addAnnualContributionForUser,
  archiveAnnualBudgetItemForUser,
  deleteAnnualSavingRateForUser,
  settleAnnualBudgetItemForUser,
  undoLatestAnnualContributionForUser,
  upsertAnnualSavingRateForUser,
  upsertAnnualBudgetItemForUser,
} from "@/server/services/annual-budget";

import { redirectWithMessage, revalidateBudgetPaths } from "./shared";

const RETURN_TO = "/app/annual";

export async function saveAnnualBudgetItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = annualBudgetItemSchema.safeParse({
    itemId: formData.get("itemId"),
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    dueMonth: formData.get("dueMonth"),
    category: formData.get("category"),
    recurrence: formData.get("recurrence"),
    savingMode: formData.get("savingMode"),
    initialSavingMonth: formData.get("initialSavingMonth") ?? "",
    initialSavingEndMonth: formData.get("initialSavingEndMonth") ?? "",
    initialMonthlyAmount: formData.get("initialMonthlyAmount") ?? "",
  });

  if (!parsed.success) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      parsed.error.issues[0]?.message ?? "Årskostnaden är ogiltig.",
    );
  }

  try {
    await upsertAnnualBudgetItemForUser({
      actorUserId: user.id,
      itemId: parsed.data.itemId || null,
      name: parsed.data.name,
      targetAmount: parsed.data.targetAmount,
      dueMonth: parsed.data.dueMonth,
      category: parsed.data.category,
      recurrence: parsed.data.recurrence,
      savingMode: parsed.data.savingMode,
      initialSavingMonth: parsed.data.initialSavingMonth || null,
      initialSavingEndMonth: parsed.data.initialSavingEndMonth || null,
      initialMonthlyAmount: parsed.data.initialMonthlyAmount || null,
    });
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte spara årskostnaden.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(RETURN_TO, "notice", "Årskostnaden sparades.");
}

export async function saveAnnualSavingRateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = annualSavingRateSchema.safeParse({
    itemId: formData.get("itemId"),
    startMonth: formData.get("startMonth"),
    endMonth: formData.get("endMonth") ?? "",
    monthlyAmount: formData.get("monthlyAmount"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      parsed.error.issues[0]?.message ?? "Sparsteget är ogiltigt.",
    );
  }

  try {
    await upsertAnnualSavingRateForUser({
      actorUserId: user.id,
      itemId: parsed.data.itemId,
      startMonth: parsed.data.startMonth,
      endMonth: parsed.data.endMonth || null,
      monthlyAmount: parsed.data.monthlyAmount,
    });
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte spara sparsteget.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(RETURN_TO, "notice", "Spartrappan uppdaterades.");
}

export async function deleteAnnualSavingRateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteAnnualSavingRateSchema.safeParse({
    itemId: formData.get("itemId"),
    rateId: formData.get("rateId"),
  });

  if (!parsed.success) {
    redirectWithMessage(RETURN_TO, "error", "Kunde inte ta bort sparsteget.");
  }

  try {
    await deleteAnnualSavingRateForUser({
      actorUserId: user.id,
      itemId: parsed.data.itemId,
      rateId: parsed.data.rateId,
    });
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte ta bort sparsteget.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(RETURN_TO, "notice", "Sparsteget togs bort.");
}

export async function addAnnualContributionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = annualContributionSchema.safeParse({
    itemId: formData.get("itemId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      parsed.error.issues[0]?.message ?? "Insättningen är ogiltig.",
    );
  }

  try {
    await addAnnualContributionForUser({
      actorUserId: user.id,
      itemId: parsed.data.itemId,
      amount: parsed.data.amount,
    });
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte lägga till sparandet.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(RETURN_TO, "notice", "Beloppet lades till.");
}

export async function undoAnnualContributionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = annualItemIdSchema.safeParse({
    itemId: formData.get("itemId"),
  });

  if (!parsed.success) {
    redirectWithMessage(RETURN_TO, "error", "Kunde inte ångra insättningen.");
  }

  try {
    await undoLatestAnnualContributionForUser({
      actorUserId: user.id,
      itemId: parsed.data.itemId,
    });
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte ångra insättningen.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(RETURN_TO, "notice", "Senaste insättningen ångrades.");
}

export async function archiveAnnualBudgetItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = annualItemIdSchema.safeParse({
    itemId: formData.get("itemId"),
  });

  if (!parsed.success) {
    redirectWithMessage(RETURN_TO, "error", "Kunde inte avsluta årskostnaden.");
  }

  try {
    await archiveAnnualBudgetItemForUser({
      actorUserId: user.id,
      itemId: parsed.data.itemId,
    });
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte avsluta årskostnaden.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(RETURN_TO, "notice", "Årskostnaden avslutades.");
}

export async function settleAnnualBudgetItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = settleAnnualBudgetItemSchema.safeParse({
    itemId: formData.get("itemId"),
    monthId: formData.get("monthId"),
    amount: formData.get("amount"),
    payerType: formData.get("payerType"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      parsed.error.issues[0]?.message ?? "Betalningen är ogiltig.",
    );
  }

  try {
    await settleAnnualBudgetItemForUser({
      actorUserId: user.id,
      itemId: parsed.data.itemId,
      monthId: parsed.data.monthId,
      amount: parsed.data.amount,
      payerType: parsed.data.payerType,
    });
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte registrera kostnaden.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(
    RETURN_TO,
    "notice",
    "Kostnaden registrerades som betald.",
  );
}
