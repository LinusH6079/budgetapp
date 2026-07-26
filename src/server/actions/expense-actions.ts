"use server";

import {
  deleteExpenseSchema,
  expenseSchema,
  settleExpensesWithSwishSchema,
  toggleExpensePaidSchema,
} from "@/lib/validations";
import { requireUser } from "@/lib/session";
import {
  deleteExpenseForUser,
  settleExpensesWithSwishForUser,
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
    payerType: formData.get("payerType"),
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
      payerType: parsed.data.payerType,
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
    targetPayerType: formData.get("targetPayerType") || undefined,
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
      targetPayerType: parsed.data.targetPayerType,
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

export async function toggleExpensePaidOptimisticAction(input: {
  expenseId: string;
  monthId: string;
  nextPaidState: "paid" | "unpaid";
  targetPayerType?: "FIRST_PERSON" | "SECOND_PERSON";
  returnTo?: string;
}) {
  const user = await requireUser();
  const parsed = toggleExpensePaidSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      message: "Kunde inte ändra betalstatus.",
    };
  }

  try {
    const expense = await setExpensePaidStateForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      expenseId: parsed.data.expenseId,
      nextPaidState: parsed.data.nextPaidState,
      targetPayerType: parsed.data.targetPayerType,
    });

    revalidateBudgetPaths(input.returnTo);

    return {
      ok: true as const,
      isPaid: expense.isPaid,
      paidAt: expense.paidAt ? expense.paidAt.toISOString() : null,
      firstPersonPaidAt: expense.firstPersonPaidAt?.toISOString() ?? null,
      secondPersonPaidAt: expense.secondPersonPaidAt?.toISOString() ?? null,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Kunde inte ändra betalstatus.",
    };
  }
}

export async function settleExpensesWithSwishAction(input: {
  monthId: string;
  expenseIds: string[];
  swishId: string;
  returnTo?: string;
}) {
  const user = await requireUser();
  const parsed = settleExpensesWithSwishSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Kunde inte markera utgifterna.",
    };
  }

  try {
    const result = await settleExpensesWithSwishForUser({
      actorUserId: user.id,
      monthId: parsed.data.monthId,
      expenseIds: parsed.data.expenseIds,
      swishId: parsed.data.swishId,
    });

    revalidateBudgetPaths(input.returnTo);

    return {
      ok: true as const,
      count: result.count,
      totalAmount: result.totalAmount,
      swishId: result.swishId,
      paidAt: result.paidAt.toISOString(),
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Kunde inte markera utgifterna.",
    };
  }
}
