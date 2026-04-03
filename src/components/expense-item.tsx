import { CheckCircle2, Clock3 } from "lucide-react";
import { PayerType } from "@prisma/client";

import { formatDateTime } from "@/lib/utils";
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
    <article className="rounded-[28px] bg-white px-4 py-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{expense.name}</h3>
              <span className="rounded-full bg-[var(--color-panel-strong)] px-2.5 py-1 text-xs font-semibold">
                {expense.category}
              </span>
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)]">
                {expense.planningType === "UNPLANNED" ? "Ej planerad" : "Planerad"}
              </span>
            </div>
            <p className="muted mt-2">
              {payerLabels[expense.payerType]} · {expense.expenseType === "RECURRING" ? "Återkommande" : "Engångs"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xl font-semibold tracking-[-0.03em]">{formatCurrency(expense.amount)}</p>
            <p className="muted mt-1">
              {expense.dueDate ? `Förfaller ${expense.dueDate.toLocaleDateString("sv-SE")}` : "Inget förfallodatum"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-medium ${
              expense.isPaid
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
            }`}
          >
            {expense.isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
            {expense.isPaid ? "Betald" : "Obetald"}
          </span>
          <span className="muted">Senast ändrad {formatDateTime(expense.updatedAt)}</span>
          <span className="muted">av {expense.updatedByUser?.name ?? "okänd"}</span>
        </div>

        {expense.note ? <p className="text-sm text-[var(--color-muted)]">{expense.note}</p> : null}

        <div className="flex flex-wrap gap-2">
          <form action={toggleExpensePaidAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="monthId" value={monthId} />
            <input type="hidden" name="expenseId" value={expense.id} />
            <input type="hidden" name="nextPaidState" value={expense.isPaid ? "unpaid" : "paid"} />
            <button
              disabled={isLocked}
              className="rounded-2xl border border-[var(--color-line)] px-4 py-2 text-sm font-semibold disabled:bg-[var(--color-line)]"
            >
              {expense.isPaid ? "Markera som obetald" : "Markera som betald"}
            </button>
          </form>

          <details className="min-w-full">
            <summary className="inline-flex cursor-pointer rounded-2xl border border-[var(--color-line)] px-4 py-2 text-sm font-semibold">
              Redigera
            </summary>
            <div className="mt-4 rounded-[24px] bg-[var(--color-surface)] px-4 py-4">
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
            <button
              disabled={isLocked}
              className="rounded-2xl border border-[var(--color-danger)]/30 px-4 py-2 text-sm font-semibold text-[var(--color-danger)] disabled:bg-[var(--color-line)]"
            >
              Ta bort
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
