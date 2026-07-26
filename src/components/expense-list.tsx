"use client";

import { PayerType } from "@prisma/client";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ExpenseItem } from "@/components/expense-item";
import { ModalLauncher } from "@/components/modal-launcher";
import { PendingLink } from "@/components/pending-link";
import { expensePartAmount } from "@/lib/budget-calculations";
import { formatCurrency } from "@/lib/money";
import { settleExpensesWithSwishAction } from "@/server/actions/expense-actions";

type ExpenseListProps = {
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  expenses: Array<{
    id: string;
    name: string;
    amount: number;
    category: string;
    expenseType: "RECURRING" | "ONE_TIME";
    payerType: PayerType;
    dueDate: Date | null;
    isPaid: boolean;
    paidAt: Date | null;
    firstPersonPaidAt: Date | null;
    secondPersonPaidAt: Date | null;
    swishId: string | null;
    firstPersonSwishId: string | null;
    secondPersonSwishId: string | null;
    updatedAt: Date;
    updatedByUser: {
      name: string;
    } | null;
  }>;
  memberOptions: Array<{
    label: string;
    value: "FIRST_PERSON" | "SECOND_PERSON";
  }>;
  currentUserPayerType: "FIRST_PERSON" | "SECOND_PERSON";
  payerLabels: Record<PayerType, string>;
  currentFilters: {
    status: string;
    type: string;
    category: string;
  };
  categories: string[];
  quickFilters: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
};

type SwishSelection = {
  expenseId: string;
  targetPayerType?: "FIRST_PERSON" | "SECOND_PERSON";
};

function selectionKey(selection: SwishSelection) {
  return `${selection.expenseId}:${selection.targetPayerType ?? "FULL"}`;
}

export function ExpenseList({
  monthId,
  returnTo,
  isLocked,
  expenses,
  memberOptions,
  currentUserPayerType,
  payerLabels,
  currentFilters,
  categories,
  quickFilters,
}: ExpenseListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activePayers, setActivePayers] = useState<PayerType[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedParts, setSelectedParts] = useState<SwishSelection[]>([]);
  const [swishId, setSwishId] = useState("");
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleNotice, setSettleNotice] = useState<string | null>(null);

  const visibleExpenses = useMemo(() => {
    if (activePayers.length === 0) {
      return expenses;
    }

    return expenses.filter(
      (expense) =>
        expense.payerType === PayerType.SHARED ||
        activePayers.includes(expense.payerType),
    );
  }, [activePayers, expenses]);

  const selectedTotal = selectedParts.reduce((sum, selection) => {
    const expense = expenses.find(
      (candidate) => candidate.id === selection.expenseId,
    );

    if (!expense) {
      return sum;
    }

    if (expense.payerType !== PayerType.SHARED) {
      return sum + expense.amount;
    }

    return sum + expensePartAmount(expense.amount, selection.targetPayerType);
  }, 0);
  const selectableExpenseCount = visibleExpenses.reduce((count, expense) => {
    if (expense.payerType !== PayerType.SHARED) {
      return count + Number(!expense.isPaid);
    }

    return (
      count +
      Number(!expense.firstPersonPaidAt) +
      Number(!expense.secondPersonPaidAt)
    );
  }, 0);

  const togglePayer = (payer: PayerType) => {
    setActivePayers((current) =>
      current.includes(payer) ? current.filter((value) => value !== payer) : [...current, payer],
    );
  };

  const toggleSelectionMode = () => {
    setSelectionMode((current) => {
      const nextValue = !current;
      if (!nextValue) {
        setSelectedParts([]);
        setSwishId("");
        setSettleError(null);
      }
      return nextValue;
    });
  };

  const toggleExpenseSelection = (selection: SwishSelection) => {
    const key = selectionKey(selection);
    setSelectedParts((current) =>
      current.some((part) => selectionKey(part) === key)
        ? current.filter((part) => selectionKey(part) !== key)
        : [...current, selection],
    );
  };

  const settleSelectedExpenses = () => {
    if (isPending || selectedParts.length === 0) {
      return;
    }

    setSettleError(null);
    setSettleNotice(null);

    startTransition(async () => {
      const result = await settleExpensesWithSwishAction({
        monthId,
        selections: selectedParts,
        swishId,
        returnTo,
      });

      if (!result.ok) {
        setSettleError(result.message ?? "Kunde inte markera utgifterna.");
        return;
      }

      setSelectionMode(false);
      setSelectedParts([]);
      setSwishId("");
      setSettleNotice(`Swish ${result.swishId} sparades för ${result.count} delar.`);
      router.refresh();
    });
  };

  return (
    <section className="grid gap-3">
      <div className="app-panel px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow-label">Utgifter</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Alla poster</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectionMode}
              disabled={isLocked || selectableExpenseCount === 0}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                selectionMode
                  ? "bg-[var(--color-accent-strong)] text-[#09090b]"
                  : "bg-[var(--color-elevated)] text-[var(--color-ink)]"
              } ${isLocked || selectableExpenseCount === 0 ? "opacity-50" : ""}`}
            >
              {selectionMode ? "Avsluta" : "Välj flera"}
            </button>

            <ModalLauncher
              title="Filter"
              description="Justera vilka utgifter som visas."
              trigger={
                <span className="icon-action-button">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
              }
            >
              <form
                method="get"
                className="grid gap-3"
                onSubmit={() => window.dispatchEvent(new CustomEvent("app:navigation-start"))}
              >
                <input type="hidden" name="tab" value="expenses" />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Status</span>
                  <select name="status" defaultValue={currentFilters.status}>
                    <option value="all">Alla</option>
                    <option value="paid">Betalda</option>
                    <option value="unpaid">Obetalda</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Typ</span>
                  <select name="type" defaultValue={currentFilters.type}>
                    <option value="all">Alla typer</option>
                    <option value="RECURRING">Återkommande</option>
                    <option value="ONE_TIME">Engångs</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Kategori</span>
                  <select name="category" defaultValue={currentFilters.category}>
                    <option value="all">Alla kategorier</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="action-button action-primary w-full justify-center">Visa utgifter</button>
              </form>
            </ModalLauncher>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <PendingLink
              key={filter.label}
              href={filter.href}
              prefetch
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filter.active
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                  : "bg-[var(--color-elevated)] text-[var(--color-muted)]"
              }`}
            >
              {filter.label}
            </PendingLink>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {memberOptions.map((option) => {
            const isActive = activePayers.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => togglePayer(option.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-[var(--color-accent-strong)] text-[#09090b]"
                    : "bg-[var(--color-elevated)] text-[var(--color-muted)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {selectionMode ? (
          <div className="mt-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Swish-markera flera</p>
                <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                  Välj hela utgifter eller en persons halva och spara samma Swish ID som du använder utanför appen.
                </p>
              </div>
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink)]">
                {selectedParts.length} valda
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-muted)]">Summa att swisha</p>
              <p className="text-base font-semibold">{formatCurrency(selectedTotal)}</p>
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-medium">Swish ID</span>
              <input
                value={swishId}
                onChange={(event) => setSwishId(event.target.value)}
                placeholder="SWISH-2026-001"
                disabled={isPending}
              />
            </label>

            {settleError ? <p className="mt-2 text-[12px] font-medium text-[var(--color-danger)]">{settleError}</p> : null}
            {settleNotice ? (
              <p className="mt-2 text-[12px] font-medium text-[var(--color-ink)]/80">{settleNotice}</p>
            ) : null}

            <button
              type="button"
              onClick={settleSelectedExpenses}
              disabled={isPending || selectedParts.length === 0 || swishId.trim().length === 0}
              className="action-button action-primary mt-3 w-full justify-center"
            >
              {isPending ? "Markerar..." : "Markera valda som klara"}
            </button>
          </div>
        ) : null}
      </div>

      {visibleExpenses.length > 0 ? (
        <div className="app-panel px-2.5 py-2.5 sm:px-3 sm:py-3">
          <div className="max-h-[min(62dvh,680px)] overflow-y-auto overscroll-contain pr-1 no-scrollbar">
            <div className="grid gap-2">
              {visibleExpenses.map((expense) => (
                <ExpenseItem
                  key={`${expense.id}-${expense.isPaid ? "paid" : "unpaid"}-${expense.paidAt?.toISOString() ?? "none"}-${expense.firstPersonPaidAt?.toISOString() ?? "first-open"}-${expense.secondPersonPaidAt?.toISOString() ?? "second-open"}-${expense.swishId ?? "no-swish"}`}
                  expense={expense}
                  monthId={monthId}
                  returnTo={returnTo}
                  isLocked={isLocked}
                  payerLabels={payerLabels}
                  memberOptions={memberOptions}
                  currentUserPayerType={currentUserPayerType}
                  selectionMode={selectionMode}
                  selectedParts={selectedParts
                    .filter((part) => part.expenseId === expense.id)
                    .map((part) => part.targetPayerType ?? "FULL")}
                  onToggleSelect={toggleExpenseSelection}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="app-panel px-4 py-6 text-sm text-[var(--color-muted)]">
          Inga utgifter matchar filtret just nu.
        </div>
      )}
    </section>
  );
}
