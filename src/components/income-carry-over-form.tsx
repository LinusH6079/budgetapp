import { formatCurrency, formatEditableAmount } from "@/lib/money";
import { updateSnapshotAction } from "@/server/actions/month-actions";
import { FormStatusButton } from "@/components/form-status-button";

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
    <section className="app-panel px-5 py-5 sm:px-6">
      <h2 className="section-title">Inkomster och ingående saldo</h2>
      <p className="muted mt-2">En rad per person och månad. Siffrorna sparas var för sig men summeras automatiskt.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {personSnapshots.map((snapshot) => (
          <form key={snapshot.userId} action={updateSnapshotAction} className="surface-card">
            <input type="hidden" name="monthId" value={monthId} />
            <input type="hidden" name="userId" value={snapshot.userId} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{snapshot.user.name}</h3>
                <p className="muted mt-1">
                  Senast uppdaterad {snapshot.updatedAt.toLocaleDateString("sv-SE")} av{" "}
                  {snapshot.updatedByUser?.name ?? "okänd"}
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
                <span className="mb-2 block text-sm font-medium">Ingående saldo</span>
                <input
                  name="carryOverAmount"
                  defaultValue={formatEditableAmount(snapshot.carryOverAmount)}
                  inputMode="decimal"
                  disabled={isLocked}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-[var(--color-muted)]">
                Tillgängligt just nu {formatCurrency(snapshot.incomeAmount + snapshot.carryOverAmount)}
              </p>
              <FormStatusButton
                disabled={isLocked}
                className="action-secondary"
                pendingLabel="Sparar..."
              >
                Spara
              </FormStatusButton>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}
