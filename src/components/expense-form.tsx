import { ExpenseType, PayerType, PlanningType } from "@prisma/client";

import { formatEditableAmount } from "@/lib/money";
import { toDateInputValue } from "@/lib/date";
import { saveExpenseAction } from "@/server/actions/expense-actions";

type ExpenseFormProps = {
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  memberOptions: Array<{
    label: string;
    value: PayerType;
  }>;
  expense?: {
    id: string;
    name: string;
    amount: number;
    category: string;
    expenseType: ExpenseType;
    planningType: PlanningType;
    payerType: PayerType;
    dueDate: Date | null;
    isPaid: boolean;
    paidAt: Date | null;
    note: string | null;
  };
};

export function ExpenseForm({
  monthId,
  returnTo,
  isLocked,
  memberOptions,
  expense,
}: ExpenseFormProps) {
  return (
    <form action={saveExpenseAction} className="grid gap-3">
      <input type="hidden" name="monthId" value={monthId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="expenseId" value={expense?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-medium">Namn</span>
          <input name="name" defaultValue={expense?.name} placeholder="Hyra" disabled={isLocked} required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Belopp</span>
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={expense ? formatEditableAmount(expense.amount) : ""}
            placeholder="1200"
            disabled={isLocked}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Kategori</span>
          <input
            name="category"
            defaultValue={expense?.category}
            placeholder="Boende"
            disabled={isLocked}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Typ</span>
          <select name="expenseType" defaultValue={expense?.expenseType ?? ExpenseType.ONE_TIME} disabled={isLocked}>
            <option value={ExpenseType.ONE_TIME}>Engångs</option>
            <option value={ExpenseType.RECURRING}>Återkommande</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Planering</span>
          <select
            name="planningType"
            defaultValue={expense?.planningType ?? PlanningType.PLANNED}
            disabled={isLocked}
          >
            <option value={PlanningType.PLANNED}>Planerad</option>
            <option value={PlanningType.UNPLANNED}>Ej planerad</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Betalas av</span>
          <select name="payerType" defaultValue={expense?.payerType ?? PayerType.SHARED} disabled={isLocked}>
            {memberOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Förfallodatum</span>
          <input
            name="dueDate"
            type="date"
            defaultValue={toDateInputValue(expense?.dueDate)}
            disabled={isLocked}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Betald?</span>
          <select name="isPaid" defaultValue={expense?.isPaid ? "true" : "false"} disabled={isLocked}>
            <option value="false">Nej</option>
            <option value="true">Ja</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Betaldatum</span>
          <input
            name="paidAt"
            type="date"
            defaultValue={toDateInputValue(expense?.paidAt)}
            disabled={isLocked}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-medium">Anteckning</span>
          <textarea
            name="note"
            rows={3}
            defaultValue={expense?.note ?? ""}
            placeholder="Valfri kommentar"
            disabled={isLocked}
          />
        </label>
      </div>

      <button
        disabled={isLocked}
        className="mt-1 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:bg-[var(--color-line)]"
      >
        {expense ? "Spara ändringar" : "Lägg till utgift"}
      </button>
    </form>
  );
}
