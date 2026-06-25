"use client";

import { PayerType } from "@prisma/client";
import { Check, Circle, Pencil, SquareCheckBig, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { formatCurrency } from "@/lib/money";
import { deleteExpenseAction, toggleExpensePaidOptimisticAction } from "@/server/actions/expense-actions";

import { ExpenseForm } from "./expense-form";

type ExpenseItemProps = {
  expense: {
    id: string;
    name: string;
    amount: number;
    category: string;
    expenseType: "RECURRING" | "ONE_TIME";
    payerType: PayerType;
    dueDate: Date | null;
    isPaid: boolean;
    paidAt: Date | null;
    swishId: string | null;
    updatedAt: Date;
    updatedByUser: {
      name: string;
    } | null;
  };
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  payerLabels: Record<PayerType, string>;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (expenseId: string) => void;
};

function formatShortDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function ExpenseItem({
  expense,
  monthId,
  returnTo,
  isLocked,
  payerLabels,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: ExpenseItemProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticPaid, setOptimisticPaid] = useState(expense.isPaid);
  const [optimisticPaidAt, setOptimisticPaidAt] = useState<Date | null>(expense.paidAt);
  const [optimisticSwishId, setOptimisticSwishId] = useState<string | null>(expense.swishId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setErrorMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [errorMessage]);

  const secondaryText = useMemo(() => {
    const paidLabel =
      optimisticPaid && optimisticPaidAt ? `Betald ${formatShortDate(optimisticPaidAt)}` : "Obetald";

    const parts = [
      formatShortDate(expense.dueDate),
      expense.category,
      payerLabels[expense.payerType],
      optimisticSwishId ? `Swish ${optimisticSwishId}` : paidLabel,
    ].filter((value): value is string => Boolean(value));

    return parts.join(" · ");
  }, [expense.category, expense.dueDate, expense.payerType, optimisticPaid, optimisticPaidAt, optimisticSwishId, payerLabels]);

  const togglePaid = () => {
    if (isLocked || isPending || selectionMode) {
      return;
    }

    const nextPaid = !optimisticPaid;
    const previousPaid = optimisticPaid;
    const previousPaidAt = optimisticPaidAt;
    const previousSwishId = optimisticSwishId;
    const nextPaidAt = nextPaid ? new Date() : null;

    setErrorMessage(null);
    setOptimisticPaid(nextPaid);
    setOptimisticPaidAt(nextPaidAt);
    if (!nextPaid) {
      setOptimisticSwishId(null);
    }

    startTransition(async () => {
      const result = await toggleExpensePaidOptimisticAction({
        monthId,
        expenseId: expense.id,
        nextPaidState: nextPaid ? "paid" : "unpaid",
        returnTo,
      });

      if (!result.ok) {
        setOptimisticPaid(previousPaid);
        setOptimisticPaidAt(previousPaidAt);
        setOptimisticSwishId(previousSwishId);
        setErrorMessage(result.message ?? "Kunde inte ändra betalstatus.");
        return;
      }

      setOptimisticPaid(result.isPaid);
      setOptimisticPaidAt(result.paidAt ? new Date(result.paidAt) : null);
      if (!result.isPaid) {
        setOptimisticSwishId(null);
      }
    });
  };

  const canSelect = selectionMode && !optimisticPaid && !isLocked;

  return (
    <article
      className={`w-full overflow-hidden rounded-[16px] border px-3 py-2.5 transition-[background-color,border-color,transform] duration-200 ${
        isSelected
          ? "border-[rgba(244,244,245,0.36)] bg-[rgba(39,39,42,0.88)]"
          : optimisticPaid
            ? "border-[rgba(34,197,94,0.28)] bg-[rgba(20,83,45,0.16)]"
            : "border-[var(--color-line)] bg-[var(--color-elevated)]"
      } ${canSelect ? "cursor-pointer" : ""}`}
      onClick={canSelect && onToggleSelect ? () => onToggleSelect(expense.id) : undefined}
    >
      <div className="flex items-center gap-2.5">
        {selectionMode ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canSelect && onToggleSelect) {
                onToggleSelect(expense.id);
              }
            }}
            disabled={!canSelect}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
              isSelected
                ? "bg-[var(--color-accent-strong)] text-[#09090b]"
                : "bg-[rgba(255,255,255,0.05)] text-[var(--color-muted)]"
            } ${!canSelect ? "opacity-50" : ""}`}
            aria-label={isSelected ? "Ta bort från Swish-markering" : "Lägg till i Swish-markering"}
          >
            {isSelected ? <SquareCheckBig className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={togglePaid}
            disabled={isLocked || isPending}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
              optimisticPaid
                ? "bg-[#22c55e] text-white shadow-[0_8px_18px_rgba(34,197,94,0.22)]"
                : "bg-[var(--color-accent-strong)] text-[#09090b]"
            } ${isPending ? "opacity-85" : ""}`}
            aria-busy={isPending}
            aria-label={optimisticPaid ? "Markera som obetald" : "Markera som betald"}
            title={optimisticPaid ? "Markera som obetald" : "Markera som betald"}
          >
            {isPending ? <span className="spinner h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">{expense.name}</p>
            <p className="shrink-0 text-[15px] font-semibold tracking-[-0.03em]">{formatCurrency(expense.amount)}</p>
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                optimisticPaid
                  ? "bg-[rgba(34,197,94,0.18)] text-[#86efac]"
                  : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
              }`}
            >
              {optimisticPaid ? "Betald" : "Obetald"}
            </span>
            <p className="truncate text-[11px] text-[var(--color-muted)]">{secondaryText}</p>
          </div>
        </div>

        {!selectionMode ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <ModalLauncher
              title="Redigera utgift"
              description="Justera namn, belopp, kategori eller typ."
              dialogClassName="sm:max-w-xl"
              trigger={
                <span className="icon-action-button !h-8 !w-8">
                  <Pencil className="h-3.5 w-3.5" />
                </span>
              }
            >
              <ExpenseForm monthId={monthId} returnTo={returnTo} isLocked={isLocked} expense={expense} />
            </ModalLauncher>

            <form action={deleteExpenseAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="monthId" value={monthId} />
              <input type="hidden" name="expenseId" value={expense.id} />
              <FormStatusButton
                disabled={isLocked}
                className="icon-action-button icon-action-danger !h-8 !w-8"
                pendingLabel=""
                aria-label="Ta bort utgift"
                title="Ta bort utgift"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </FormStatusButton>
            </form>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-2 text-[11px] font-medium text-[var(--color-danger)]">{errorMessage}</p>
      ) : null}
    </article>
  );
}
