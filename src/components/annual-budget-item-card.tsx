import { Archive, CheckCircle2, Ellipsis, Plus, RotateCcw } from "lucide-react";

import { AnnualBudgetForm } from "@/components/annual-budget-form";
import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency, formatEditableAmount } from "@/lib/money";
import {
  addAnnualContributionAction,
  archiveAnnualBudgetItemAction,
  settleAnnualBudgetItemAction,
  undoAnnualContributionAction,
} from "@/server/actions/annual-budget-actions";

type AnnualBudgetItemCardProps = {
  item: {
    id: string;
    name: string;
    targetAmount: number;
    dueMonth: string;
    category: string | null;
    recurrence: "ONE_TIME" | "YEARLY";
    reservedAmount: number;
    remainingAmount: number;
    recommendedMonthlyAmount: number;
    fundedFraction: number;
    updatedAt: Date;
    updatedByUser: { name: string } | null;
    latestContribution: {
      id: string;
      amount: number;
    } | null;
  };
  defaultDueMonth: string;
  months: Array<{
    id: string;
    monthKey: string;
  }>;
  memberOptions: Array<{
    label: string;
    value: "FIRST_PERSON" | "SECOND_PERSON";
  }>;
};

export function AnnualBudgetItemCard({
  item,
  defaultDueMonth,
  months,
  memberOptions,
}: AnnualBudgetItemCardProps) {
  const progress = Math.min(100, Math.max(0, item.fundedFraction * 100));

  return (
    <article className="rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3.5 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{item.name}</h3>
            {item.category ? (
              <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium text-[var(--color-muted)]">
                {item.category}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            Behövs {formatMonthLabel(item.dueMonth)}
            {item.recurrence === "YEARLY" ? " · Varje år" : ""}
          </p>
        </div>

        <ModalLauncher
          title={`Spara till ${item.name}`}
          description={`${formatCurrency(item.reservedAmount)} är reserverat just nu.`}
          trigger={
            <span className="icon-action-button action-primary">
              <Plus className="h-4 w-4" />
            </span>
          }
          dialogClassName="sm:max-w-md"
        >
          <form action={addAnnualContributionAction} className="grid gap-3">
            <input type="hidden" name="itemId" value={item.id} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Lägg till reserverat belopp
              </span>
              <input
                name="amount"
                inputMode="decimal"
                placeholder={formatEditableAmount(
                  item.recommendedMonthlyAmount,
                )}
                required
              />
            </label>
            <FormStatusButton
              className="action-primary w-full justify-center"
              pendingLabel="Lägger till..."
            >
              Lägg till
            </FormStatusButton>
          </form>

          {item.latestContribution ? (
            <form action={undoAnnualContributionAction} className="mt-2">
              <input type="hidden" name="itemId" value={item.id} />
              <FormStatusButton
                className="action-secondary w-full justify-center"
                pendingLabel="Ångrar..."
              >
                <RotateCcw className="h-4 w-4" />
                Ångra senaste +{formatCurrency(item.latestContribution.amount)}
              </FormStatusButton>
            </form>
          ) : null}
        </ModalLauncher>

        <ModalLauncher
          title="Hantera årskostnad"
          description="Redigera, registrera betalning eller avsluta målet."
          trigger={
            <span className="icon-action-button">
              <Ellipsis className="h-4 w-4" />
            </span>
          }
          dialogClassName="sm:max-w-md"
        >
          <div className="grid gap-4">
            <AnnualBudgetForm
              defaultDueMonth={defaultDueMonth}
              item={item}
            />

            {months.length > 0 ? (
              <div className="border-t border-[var(--color-line)] pt-4">
                <p className="text-sm font-semibold">Registrera som betald</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                  Skapar en betald engångsutgift och använder det reserverade beloppet.
                  {item.recurrence === "YEARLY"
                    ? " Nästa års sparcykel startar automatiskt."
                    : ""}
                </p>
                <form
                  action={settleAnnualBudgetItemAction}
                  className="mt-3 grid gap-2.5"
                >
                  <input type="hidden" name="itemId" value={item.id} />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      Faktisk kostnad
                    </span>
                    <input
                      name="amount"
                      inputMode="decimal"
                      defaultValue={formatEditableAmount(item.targetAmount)}
                      required
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">
                        Månad
                      </span>
                      <select name="monthId" defaultValue={months[0]?.id}>
                        {months.map((month) => (
                          <option key={month.id} value={month.id}>
                            {formatMonthLabel(month.monthKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">
                        Betalas av
                      </span>
                      <select
                        name="payerType"
                        defaultValue={memberOptions[0]?.value}
                      >
                        {memberOptions.map((member) => (
                          <option key={member.value} value={member.value}>
                            {member.label}
                          </option>
                        ))}
                        {memberOptions.length === 2 ? (
                          <option value="SHARED">Gemensamt</option>
                        ) : null}
                      </select>
                    </label>
                  </div>
                  <FormStatusButton
                    className="action-primary w-full justify-center"
                    pendingLabel="Registrerar..."
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Registrera betalning
                  </FormStatusButton>
                </form>
              </div>
            ) : null}

            <div className="border-t border-[var(--color-line)] pt-4">
              <form action={archiveAnnualBudgetItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <FormStatusButton
                  className="action-danger w-full justify-center"
                  pendingLabel="Avslutar..."
                >
                  <Archive className="h-4 w-4" />
                  Avsluta utan utgift
                </FormStatusButton>
              </form>
              <p className="mt-2 text-center text-[10px] text-[var(--color-muted)]">
                Reserverade pengar frigörs när målet avslutas.
              </p>
            </div>
          </div>
        </ModalLauncher>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-[-0.03em]">
            {formatCurrency(item.reservedAmount)}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            av {formatCurrency(item.targetAmount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[var(--color-muted)]">Rekommenderat</p>
          <p className="mt-0.5 text-xs font-semibold">
            {formatCurrency(item.recommendedMonthlyAmount)}/mån
          </p>
        </div>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-[var(--color-accent-strong)] transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-[9px] text-[var(--color-muted)]">
        Senast ändrad {item.updatedAt.toLocaleDateString("sv-SE")}
        {item.updatedByUser ? ` av ${item.updatedByUser.name}` : ""}
      </p>
    </article>
  );
}
