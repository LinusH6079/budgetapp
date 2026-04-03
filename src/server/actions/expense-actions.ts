"use server";

import {
  deleteExpenseSchema,
  expenseSchema,
  toggleExpensePaidSchema,
} from "@/lib/validations";
import { requireUser } from "@/lib/session";
import {
  deleteExpenseForUser,
  setExpensePaidStateForUser,
  upsertExpenseForUser,
} from "@/server/services/expenses";

import { redirectWithMessage, revalidateBudgetPaths } from "./shared";

export async function saveExpenseAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app");
  const parsed = expenseSchema.safeParse({
    monthId: formData.get("monthId"),
    expenseId: formData.get("expenseId"),
    name: formData.get("name"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    expenseType: formData.get("expenseType"),
    planningType: formData.get("planningType"),
    payerType: formData.get("payerType"),
    dueDate: formData.get("dueDate"),
    isPaid: formData.get("isPaid"),
    paidAt: formData.get("paidAt"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    redirectWithMessage(returnTo, "error", parsed.error.issues[0]?.message ?? "Utgiften är ogiltig.");
  }

  try {
    await upsertExpenseForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      expenseId: parsed.data.expenseId || null,
      name: parsed.data.name,
      amount: parsed.data.amount,
      category: parsed.data.category,
      expenseType: parsed.data.expenseType,
      planningType: parsed.data.planningType,
      payerType: parsed.data.payerType,
      dueDate: parsed.data.dueDate || undefined,
      isPaid: parsed.data.isPaid === "true",
      paidAt: parsed.data.paidAt || undefined,
      note: parsed.data.note || undefined,
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Kunde inte spara utgiften.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Utgiften sparades.");
}

export async function deleteExpenseAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app");
  const parsed = deleteExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    monthId: formData.get("monthId"),
  });

  if (!parsed.success) {
    redirectWithMessage(returnTo, "error", "Kunde inte ta bort utgiften.");
  }

  try {
    await deleteExpenseForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      expenseId: parsed.data.expenseId,
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Kunde inte ta bort utgiften.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Utgiften togs bort.");
}

export async function toggleExpensePaidAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app");
  const parsed = toggleExpensePaidSchema.safeParse({
    expenseId: formData.get("expenseId"),
    monthId: formData.get("monthId"),
    nextPaidState: formData.get("nextPaidState"),
  });

  if (!parsed.success) {
    redirectWithMessage(returnTo, "error", "Kunde inte ändra betalstatus.");
  }

  try {
    await setExpensePaidStateForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      expenseId: parsed.data.expenseId,
      nextPaidState: parsed.data.nextPaidState,
    });
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Kunde inte ändra betalstatus.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(
    returnTo,
    "notice",
    parsed.data.nextPaidState === "paid" ? "Utgiften markerades som betald." : "Utgiften markerades som obetald.",
  );
}
