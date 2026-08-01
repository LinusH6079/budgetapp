"use server";

import { requireUser } from "@/lib/session";
import {
  existingLoanSchema,
  deleteFinancingCaseSchema,
  financingCaseSchema,
  financingDecisionSchema,
  loanExtraPaymentSchema,
  loanInstallmentAdjustmentSchema,
  loanRateChangeSchema,
} from "@/lib/validations";
import {
  activateFinancingCaseForUser,
  addLoanExtraPaymentForUser,
  changeLoanRateForUser,
  createFinancingCaseForUser,
  deleteFinancingCaseForUser,
  registerExistingLoanForUser,
  adjustLoanInstallmentForUser,
} from "@/server/services/loans";

import { redirectWithMessage, revalidateBudgetPaths } from "./shared";

const RETURN_TO = "/app/loans";

export async function createFinancingCaseAction(formData: FormData) {
  const user = await requireUser();
  const parsed = financingCaseSchema.safeParse({
    name: formData.get("name"),
    purchasePrice: formData.get("purchasePrice"),
    downPayment: formData.get("downPayment") || "0",
    annualInterestBps: formData.get("annualInterestRate"),
    termMonths: formData.get("termMonths"),
    setupFee: formData.get("setupFee") || "0",
    monthlyFee: formData.get("monthlyFee") || "0",
    amortizationType: formData.get("amortizationType"),
    startMonth: formData.get("startMonth"),
    payerType: formData.get("payerType"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      parsed.error.issues[0]?.message ?? "Jämförelsen är ogiltig.",
    );
  }

  let itemId: string;
  try {
    const item = await createFinancingCaseForUser({
      actorUserId: user.id,
      ...parsed.data,
    });
    itemId = item.id;
  } catch (error) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      error instanceof Error ? error.message : "Kunde inte spara jämförelsen.",
    );
  }
  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(
    `${RETURN_TO}?tab=compare&caseId=${itemId}`,
    "notice",
    "Jämförelsen sparades.",
  );
}

export async function activateFinancingCaseAction(formData: FormData) {
  const user = await requireUser();
  const parsed = financingDecisionSchema.safeParse({
    caseId: formData.get("caseId"),
    decision: formData.get("decision"),
    monthId: formData.get("monthId") ?? "",
  });

  if (!parsed.success) {
    redirectWithMessage(
      RETURN_TO,
      "error",
      parsed.error.issues[0]?.message ?? "Valet är ogiltigt.",
    );
  }

  try {
    await activateFinancingCaseForUser({
      actorUserId: user.id,
      caseId: parsed.data.caseId,
      decision: parsed.data.decision,
      monthId: parsed.data.monthId || null,
    });
  } catch (error) {
    redirectWithMessage(
      `${RETURN_TO}?tab=compare&caseId=${parsed.data.caseId}`,
      "error",
      error instanceof Error ? error.message : "Kunde inte aktivera valet.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(
    `${RETURN_TO}?tab=${parsed.data.decision === "LOAN" ? "active" : "history"}`,
    "notice",
    parsed.data.decision === "LOAN"
      ? "Lånet aktiverades och månadsutgifterna skapades."
      : "Direktbetalningen lades till i budgeten.",
  );
}

export async function deleteFinancingCaseAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteFinancingCaseSchema.safeParse({
    caseId: formData.get("caseId"),
  });
  if (!parsed.success) {
    redirectWithMessage(RETURN_TO, "error", "Jämförelsen kunde inte tas bort.");
  }
  try {
    await deleteFinancingCaseForUser({
      actorUserId: user.id,
      caseId: parsed.data.caseId,
    });
  } catch (error) {
    redirectWithMessage(
      `${RETURN_TO}?tab=compare`,
      "error",
      error instanceof Error ? error.message : "Jämförelsen kunde inte tas bort.",
    );
  }
  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(`${RETURN_TO}?tab=compare`, "notice", "Jämförelsen togs bort.");
}

export async function registerExistingLoanAction(formData: FormData) {
  const user = await requireUser();
  const parsed = existingLoanSchema.safeParse({
    name: formData.get("name"),
    principal: formData.get("principal"),
    annualInterestBps: formData.get("annualInterestRate"),
    termMonths: formData.get("termMonths"),
    setupFee: formData.get("setupFee") || "0",
    monthlyFee: formData.get("monthlyFee") || "0",
    amortizationType: formData.get("amortizationType"),
    startMonth: formData.get("startMonth"),
    payerType: formData.get("payerType"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      parsed.error.issues[0]?.message ?? "Lånet är ogiltigt.",
    );
  }

  try {
    const { principal, ...setup } = parsed.data;
    await registerExistingLoanForUser({
      actorUserId: user.id,
      setup: { ...setup, principal },
    });
  } catch (error) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      error instanceof Error ? error.message : "Kunde inte registrera lånet.",
    );
  }

  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(`${RETURN_TO}?tab=active`, "notice", "Lånet registrerades.");
}

export async function changeLoanRateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = loanRateChangeSchema.safeParse({
    loanId: formData.get("loanId"),
    startMonth: formData.get("startMonth"),
    annualInterestBps: formData.get("annualInterestRate"),
  });
  if (!parsed.success) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      parsed.error.issues[0]?.message ?? "Ränteändringen är ogiltig.",
    );
  }

  try {
    await changeLoanRateForUser({ actorUserId: user.id, ...parsed.data });
  } catch (error) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      error instanceof Error ? error.message : "Kunde inte ändra räntan.",
    );
  }
  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(`${RETURN_TO}?tab=active`, "notice", "Framtida betalningar räknades om.");
}

export async function addLoanExtraPaymentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = loanExtraPaymentSchema.safeParse({
    loanId: formData.get("loanId"),
    monthId: formData.get("monthId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      parsed.error.issues[0]?.message ?? "Extra amorteringen är ogiltig.",
    );
  }

  try {
    await addLoanExtraPaymentForUser({ actorUserId: user.id, ...parsed.data });
  } catch (error) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      error instanceof Error ? error.message : "Kunde inte lägga till amorteringen.",
    );
  }
  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(
    `${RETURN_TO}?tab=active`,
    "notice",
    "Extra amorteringen lades till i månadsbudgeten.",
  );
}

export async function adjustLoanInstallmentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = loanInstallmentAdjustmentSchema.safeParse({
    loanId: formData.get("loanId"),
    installmentId: formData.get("installmentId"),
    monthId: formData.get("monthId"),
    totalAmount: formData.get("totalAmount"),
  });
  if (!parsed.success) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      parsed.error.issues[0]?.message ?? "Betalningen är ogiltig.",
    );
  }

  try {
    await adjustLoanInstallmentForUser({ actorUserId: user.id, ...parsed.data });
  } catch (error) {
    redirectWithMessage(
      `${RETURN_TO}?tab=active`,
      "error",
      error instanceof Error ? error.message : "Kunde inte justera betalningen.",
    );
  }
  revalidateBudgetPaths(RETURN_TO);
  redirectWithMessage(
    `${RETURN_TO}?tab=active`,
    "notice",
    "Betalningen och den återstående planen uppdaterades.",
  );
}
