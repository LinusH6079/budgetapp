import { PayerType } from "@prisma/client";
import { CheckCircle2, Clock3 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { formatCurrency } from "@/lib/money";
import { deleteExpenseAction, toggleExpensePaidAction } from "@/server/actions/expense-actions";

import { ExpenseForm } from "./expense-form";

type ExpenseItemProps = {
  expense: {
    id: string;
    name: string;
    amount: number;
    category: string;
    expenseType: "RECURRING" | "ONE_TIME";
    planningType: "PLANNED" | "UNPLANNED";
    payerType: PayerType;
    dueDate: Date | null;
    isPaid: boolean;
    paidAt: Date | null;
    note: string | null;
    updatedAt: Date;
    updatedByUser: {
      name: string;
    } | null;
  };
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  payerLabels: Record<PayerType, string>;
  memberOptions: Array<{
    label: string;
    value: PayerType;
  }>;
};

export function ExpenseItem({
  expense,
  monthId,
  returnTo,
  isLocked,
  payerLabels,
  memberOptions,
}: ExpenseItemProps) {
  return (
    <article className="surface-card content-auto">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{expense.name}</h3>
              <span className="pill-tag bg-[var(--color-panel-strong)]">{expense.category}</span>
              {expense.planningType === "UNPLANNED" ? (
                <span className="pill-tag bg-[var(--color-danger-soft)] text-[var(--color-danger)]">Ej planerad</span>
              ) : null}
            </div>
            <p className="muted mt-2">
              {payerLabels[expense.payerType]} · {expense.expenseType === "RECURRING" ? "Återkommande" : "Engångs"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xl font-semibold tracking-[-0.03em]">{formatCurrency(expense.amount)}</p>
            <p className="muted mt-1">
              {expense.dueDate ? expense.dueDate.toLocaleDateString("sv-SE") : "Ingen dag"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-medium ${
              expense.isPaid
                ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
            }`}
          >
            {expense.isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
            {expense.isPaid ? "Betald" : "Obetald"}
          </span>
          {expense.note ? <span className="muted">{expense.note}</span> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={toggleExpensePaidAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="monthId" value={monthId} />
            <input type="hidden" name="expenseId" value={expense.id} />
            <input type="hidden" name="nextPaidState" value={expense.isPaid ? "unpaid" : "paid"} />
            <FormStatusButton
              disabled={isLocked}
              className="action-secondary"
              pendingLabel={expense.isPaid ? "Ångrar..." : "Markerar..."}
            >
              {expense.isPaid ? "Obetald" : "Betald"}
            </FormStatusButton>
          </form>

          <details className="min-w-full">
            <summary className="inline-flex cursor-pointer rounded-xl border border-[var(--color-line)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-ink)]">
              Redigera
            </summary>
            <div className="ghost-panel mt-4 px-4 py-4">
              <ExpenseForm
                monthId={monthId}
                returnTo={returnTo}
                isLocked={isLocked}
                memberOptions={memberOptions}
                expense={expense}
              />
            </div>
          </details>

          <form action={deleteExpenseAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="monthId" value={monthId} />
            <input type="hidden" name="expenseId" value={expense.id} />
            <FormStatusButton disabled={isLocked} className="action-danger" pendingLabel="Tar bort...">
              Ta bort
            </FormStatusButton>
          </form>
        </div>
      </div>
    </article>
  );
}
