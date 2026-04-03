import { FormStatusButton } from "@/components/form-status-button";
import { formatEditableAmount, formatCurrency } from "@/lib/money";
import { updateSnapshotAction } from "@/server/actions/month-actions";

type IncomeCarryOverFormProps = {
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  personSnapshots: Array<{
    userId: string;
    incomeAmount: number;
    carryOverAmount: number;
    updatedAt: Date;
    user: {
      name: string;
    };
    updatedByUser: {
      name: string;
    } | null;
  }>;
};

export function IncomeCarryOverForm({
  monthId,
  returnTo,
  isLocked,
  personSnapshots,
}: IncomeCarryOverFormProps) {
  return (
    <section className="app-panel px-4 py-4 sm:px-5">
      <h2 className="section-title">Personer</h2>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {personSnapshots.map((snapshot) => (
          <form key={snapshot.userId} action={updateSnapshotAction} className="surface-card px-3.5 py-3.5">
            <input type="hidden" name="monthId" value={monthId} />
            <input type="hidden" name="userId" value={snapshot.userId} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{snapshot.user.name}</h3>
                <p className="muted mt-1">{snapshot.updatedAt.toLocaleDateString("sv-SE")}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-2.5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Inkomst</span>
                <input
                  name="incomeAmount"
                  defaultValue={formatEditableAmount(snapshot.incomeAmount)}
                  inputMode="decimal"
                  disabled={isLocked}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Saldo in</span>
                <input
                  name="carryOverAmount"
                  defaultValue={formatEditableAmount(snapshot.carryOverAmount)}
                  inputMode="decimal"
                  disabled={isLocked}
                />
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-[var(--color-muted)]">
                Totalt {formatCurrency(snapshot.incomeAmount + snapshot.carryOverAmount)}
              </p>
              <FormStatusButton disabled={isLocked} className="action-secondary" pendingLabel="Sparar...">
                Spara
              </FormStatusButton>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}
