import Link from "next/link";
import { PayerType } from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ExpenseItem } from "@/components/expense-item";

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
    sort: string;
  };
  categories: string[];
  pageInfo: {
    currentPage: number;
    pageCount: number;
    previousHref: string;
    nextHref: string;
  };
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
  pageInfo,
}: ExpenseListProps) {
  return (
    <section className="app-panel flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="section-title">Utgifter</h2>
          <p className="muted mt-2">Snabb lista, tydliga filter och inga långa skrollsektioner.</p>
        </div>

        <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="tab" value="expenses" />
          <input type="hidden" name="expensePage" value="1" />
          <select name="status" defaultValue={currentFilters.status}>
            <option value="all">Alla</option>
            <option value="paid">Betalda</option>
            <option value="unpaid">Obetalda</option>
          </select>
          <select name="type" defaultValue={currentFilters.type}>
            <option value="all">Alla typer</option>
            <option value="RECURRING">Återkommande</option>
            <option value="ONE_TIME">Engångs</option>
          </select>
          <select name="category" defaultValue={currentFilters.category}>
            <option value="all">Alla kategorier</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select name="payer" defaultValue={currentFilters.payer}>
            <option value="all">Alla personer</option>
            {memberOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={currentFilters.sort}>
            <option value="name">Sortera: namn</option>
            <option value="amount">Sortera: belopp</option>
          </select>
          <button className="action-button action-secondary lg:col-span-5">Filtrera</button>
        </form>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <div className="grid gap-3">
          {expenses.length > 0 ? (
            expenses.map((expense) => (
              <ExpenseItem
                key={expense.id}
                expense={expense}
                monthId={monthId}
                returnTo={returnTo}
                isLocked={isLocked}
                payerLabels={payerLabels}
              />
            ))
          ) : (
            <div className="surface-card text-sm text-[var(--color-muted)]">Inga utgifter matchar filtret ännu.</div>
          )}
        </div>

        {pageInfo.pageCount > 1 ? (
          <div className="mt-auto flex items-center justify-between">
            <Link
              href={pageInfo.previousHref}
              className={`action-button action-secondary ${pageInfo.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              prefetch
            >
              <ChevronLeft className="h-4 w-4" />
              Föregående
            </Link>
            <span className="text-sm text-[var(--color-muted)]">
              {pageInfo.currentPage}/{pageInfo.pageCount}
            </span>
            <Link
              href={pageInfo.nextHref}
              className={`action-button action-secondary ${pageInfo.currentPage >= pageInfo.pageCount ? "pointer-events-none opacity-50" : ""}`}
              prefetch
            >
              Nästa
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
