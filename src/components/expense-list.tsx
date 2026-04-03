import { PayerType } from "@prisma/client";

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
}: ExpenseListProps) {
  return (
    <section className="app-panel px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="section-title">Utgifter</h2>
          <p className="muted mt-2">Lägg till, filtrera och markera poster som betalda direkt här.</p>
        </div>

        <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="tab" value="expenses" />
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

      <div className="mt-5 grid gap-4">
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
    </section>
  );
}
