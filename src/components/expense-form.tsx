import { ExpenseType, PayerType } from "@prisma/client";

import { FormStatusButton } from "@/components/form-status-button";
import { formatEditableAmount } from "@/lib/money";
import { saveExpenseAction } from "@/server/actions/expense-actions";

type ExpenseFormProps = {
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  expense?: {
    id: string;
    name: string;
    amount: number;
    category: string;
    expenseType: ExpenseType;
    payerType: PayerType;
    isPaid: boolean;
    paidAt: Date | null;
  };
};

export function ExpenseForm({ monthId, returnTo, isLocked, expense }: ExpenseFormProps) {
  return (
    <form
      action={saveExpenseAction}
      className="grid gap-2.5"
      onSubmit={() => window.dispatchEvent(new CustomEvent("app:navigation-start"))}
    >
      <input type="hidden" name="monthId" value={monthId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="expenseId" value={expense?.id ?? ""} />

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Namn</span>
          <input name="name" defaultValue={expense?.name} placeholder="Hyra" disabled={isLocked} required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Belopp</span>
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
          <span className="mb-1.5 block text-sm font-medium">Kategori</span>
          <input
            name="category"
            defaultValue={expense?.category}
            placeholder="Boende"
            disabled={isLocked}
            required
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Typ</span>
          <select name="expenseType" defaultValue={expense?.expenseType ?? ExpenseType.ONE_TIME} disabled={isLocked}>
            <option value={ExpenseType.ONE_TIME}>Engångs</option>
            <option value={ExpenseType.RECURRING}>Återkommande</option>
          </select>
        </label>
      </div>

      <FormStatusButton
        disabled={isLocked}
        className="action-primary mt-1 w-full justify-center"
        pendingLabel={expense ? "Sparar..." : "Lägger till..."}
      >
        {expense ? "Spara" : "Lägg till"}
      </FormStatusButton>
    </form>
  );
}
