import { PayerType } from "@prisma/client";
import { CheckCircle2, Clock3, Pencil, Trash2 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
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
    payerType: PayerType;
    isPaid: boolean;
    paidAt: Date | null;
    updatedAt: Date;
    updatedByUser: {
      name: string;
    } | null;
  };
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  payerLabels: Record<PayerType, string>;
};

export function ExpenseItem({
  expense,
  monthId,
  returnTo,
  isLocked,
  payerLabels,
}: ExpenseItemProps) {
  return (
    <article className="w-full overflow-hidden rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3.5 py-3.5">
      <div className="flex w-full items-start gap-3">
        <form action={toggleExpensePaidAction} className="shrink-0">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="monthId" value={monthId} />
          <input type="hidden" name="expenseId" value={expense.id} />
          <input type="hidden" name="nextPaidState" value={expense.isPaid ? "unpaid" : "paid"} />
          <FormStatusButton
            disabled={isLocked}
            className={`!h-10 !w-10 !rounded-full !px-0 ${
              expense.isPaid ? "action-primary" : "action-secondary"
            }`}
            pendingLabel=""
            aria-label={expense.isPaid ? "Markera som obetald" : "Markera som betald"}
            title={expense.isPaid ? "Markera som obetald" : "Markera som betald"}
          >
            {expense.isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
          </FormStatusButton>
        </form>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{expense.name}</p>
              <p className="mt-1 truncate text-[12px] text-[var(--color-muted)]">
                {expense.category} · {payerLabels[expense.payerType]} ·{" "}
                {expense.expenseType === "RECURRING" ? "Återkommande" : "Engångs"}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold tracking-[-0.03em]">{formatCurrency(expense.amount)}</p>
              <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                {expense.isPaid && expense.paidAt ? `Betald ${expense.paidAt.toLocaleDateString("sv-SE")}` : "Ej betald"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                expense.isPaid
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                  : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
              }`}
            >
              {expense.isPaid ? "Betald" : "Obetald"}
            </span>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <ModalLauncher
                title="Redigera utgift"
                description="Justera namn, belopp, kategori eller typ."
                dialogClassName="sm:max-w-xl"
                trigger={
                  <span className="icon-action-button">
                    <Pencil className="h-4 w-4" />
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
                  className="icon-action-button icon-action-danger"
                  pendingLabel=""
                  aria-label="Ta bort utgift"
                  title="Ta bort utgift"
                >
                  <Trash2 className="h-4 w-4" />
                </FormStatusButton>
              </form>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
