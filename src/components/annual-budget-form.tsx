import { FormStatusButton } from "@/components/form-status-button";
import { formatEditableAmount } from "@/lib/money";
import { saveAnnualBudgetItemAction } from "@/server/actions/annual-budget-actions";

type AnnualBudgetFormProps = {
  defaultDueMonth: string;
  item?: {
    id: string;
    name: string;
    targetAmount: number;
    dueMonth: string;
    category: string | null;
  };
};

export function AnnualBudgetForm({
  defaultDueMonth,
  item,
}: AnnualBudgetFormProps) {
  return (
    <form action={saveAnnualBudgetItemAction} className="grid gap-3">
      <input type="hidden" name="itemId" value={item?.id ?? ""} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Namn</span>
        <input
          name="name"
          defaultValue={item?.name}
          placeholder="Bilservice"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Målbelopp</span>
          <input
            name="targetAmount"
            inputMode="decimal"
            defaultValue={
              item ? formatEditableAmount(item.targetAmount) : ""
            }
            placeholder="8000"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Behövs</span>
          <input
            name="dueMonth"
            type="month"
            defaultValue={item?.dueMonth ?? defaultDueMonth}
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Kategori <span className="text-[var(--color-muted)]">(valfritt)</span>
        </span>
        <input
          name="category"
          defaultValue={item?.category ?? ""}
          placeholder="Bil"
        />
      </label>

      <FormStatusButton
        className="action-primary mt-1 w-full justify-center"
        pendingLabel="Sparar..."
      >
        {item ? "Spara ändringar" : "Skapa årskostnad"}
      </FormStatusButton>
    </form>
  );
}
