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
      <div className="px-1">
        <p className="eyebrow-label">Personer</p>
        <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Inkomst och saldo in</h2>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {personSnapshots.map((snapshot) => (
          <form key={snapshot.userId} action={updateSnapshotAction} className="surface-card px-4 py-4">
            <input type="hidden" name="monthId" value={monthId} />
            <input type="hidden" name="userId" value={snapshot.userId} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{snapshot.user.name}</h3>
                <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                  {snapshot.updatedAt.toLocaleDateString("sv-SE")}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Inkomst</span>
                <input
                  name="incomeAmount"
                  defaultValue={formatEditableAmount(snapshot.incomeAmount)}
                  inputMode="decimal"
                  disabled={isLocked}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Saldo in</span>
                <input
                  name="carryOverAmount"
                  defaultValue={formatEditableAmount(snapshot.carryOverAmount)}
                  inputMode="decimal"
                  disabled={isLocked}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
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
