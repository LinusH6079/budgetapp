"use client";

import { PayerType } from "@prisma/client";
import { SlidersHorizontal } from "lucide-react";

import { ExpenseItem } from "@/components/expense-item";
import { ModalLauncher } from "@/components/modal-launcher";
import { PendingLink } from "@/components/pending-link";

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
    updatedAt: Date;
    updatedByUser: {
      name: string;
    } | null;
  }>;
  memberOptions: Array<{
    label: string;
    value: PayerType;
  }>;
  payerLabels: Record<PayerType, string>;
  currentFilters: {
    status: string;
    type: string;
    category: string;
    payer: string;
  };
  categories: string[];
  quickFilters: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
};

export function ExpenseList({
  monthId,
  returnTo,
  isLocked,
  expenses,
  memberOptions,
  payerLabels,
  currentFilters,
  categories,
  quickFilters,
}: ExpenseListProps) {
  return (
    <section className="grid gap-3">
      <div className="app-panel px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow-label">Utgifter</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Alla poster</h2>
          </div>

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
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Betalas av</span>
                <select name="payer" defaultValue={currentFilters.payer}>
                  <option value="all">Alla personer</option>
                  {memberOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="action-button action-primary w-full justify-center">Visa utgifter</button>
            </form>
          </ModalLauncher>
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
      </div>

      {expenses.length > 0 ? (
        <div className="app-panel px-2.5 py-2.5 sm:px-3 sm:py-3">
          <div className="max-h-[min(62dvh,680px)] overflow-y-auto overscroll-contain pr-1 no-scrollbar">
            <div className="grid gap-2">
              {expenses.map((expense) => (
                <ExpenseItem
                  key={`${expense.id}-${expense.isPaid ? "paid" : "unpaid"}-${expense.paidAt?.toISOString() ?? "none"}`}
                  expense={expense}
                  monthId={monthId}
                  returnTo={returnTo}
                  isLocked={isLocked}
                  payerLabels={payerLabels}
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
