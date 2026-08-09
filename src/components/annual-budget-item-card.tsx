import { Archive, CheckCircle2, Ellipsis, Plus, RotateCcw, Trash2 } from "lucide-react";

import { AnnualBudgetForm } from "@/components/annual-budget-form";
import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency, formatEditableAmount } from "@/lib/money";
import {
  addAnnualContributionAction,
  archiveAnnualBudgetItemAction,
  deleteAnnualSavingRateAction,
  saveAnnualSavingRateAction,
  settleAnnualBudgetItemAction,
  undoAnnualContributionAction,
} from "@/server/actions/annual-budget-actions";

type AnnualBudgetItemCardProps = {
  item: {
    id: string;
    name: string;
    targetAmount: number;
    savingStartMonth: string | null;
    dueMonth: string;
    category: string | null;
    recurrence: "ONE_TIME" | "YEARLY";
    savingMode: "TARGET_BY_DATE" | "CUSTOM_SCHEDULE";
    firstPersonSharePercent: number;
    savingRates: Array<{
      id: string;
      startMonth: string;
      endMonth: string | null;
      monthlyAmount: number;
    }>;
    reservedAmount: number;
    remainingAmount: number;
    recommendedMonthlyAmount: number;
    fundedFraction: number;
    targetShortfall: number;
    isTargetSecured: boolean;
    nextAutomaticAdjustment: {
      monthKey: string;
      amount: number;
    } | null;
    finalCatchUpAdjustment: {
      monthKey: string;
      amount: number;
    } | null;
    updatedAt: Date;
    updatedByUser: { name: string } | null;
    latestContribution: {
      id: string;
      amount: number;
    } | null;
  };
  defaultDueMonth: string;
  defaultStartMonth: string;
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
  defaultStartMonth,
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
            Sparperiod{" "}
            {formatMonthLabel(item.savingStartMonth ?? defaultStartMonth)}–
            {formatMonthLabel(item.dueMonth)}
            {item.recurrence === "YEARLY" ? " · Varje år" : ""}
            {item.savingMode === "CUSTOM_SCHEDULE" ? " · Flexibel plan" : ""}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
            {memberOptions[0]?.label ?? "Person 1"} {item.firstPersonSharePercent}% · {memberOptions[1]?.label ?? "Person 2"} {100 - item.firstPersonSharePercent}%
          </p>
          {item.savingMode === "CUSTOM_SCHEDULE" ? (
            <div className="mt-1 grid gap-0.5 text-[10px]">
              <p
                className={`font-medium ${
                  item.isTargetSecured
                    ? "text-[#86efac]"
                    : "text-[var(--color-danger)]"
                }`}
              >
                {item.isTargetSecured
                  ? `Planen når målet till ${formatMonthLabel(item.dueMonth)}`
                  : `${formatCurrency(item.targetShortfall)} saknas i målplanen`}
              </p>
              {item.nextAutomaticAdjustment ? (
                <p className="text-[var(--color-muted)]">
                  Automatisk takt från{" "}
                  {formatMonthLabel(item.nextAutomaticAdjustment.monthKey)}:{" "}
                  {formatCurrency(item.nextAutomaticAdjustment.amount)}/mån
                </p>
              ) : null}
              {item.finalCatchUpAdjustment ? (
                <p className="text-[var(--color-muted)]">
                  Slutjustering i{" "}
                  {formatMonthLabel(item.finalCatchUpAdjustment.monthKey)}:{" "}
                  {formatCurrency(item.finalCatchUpAdjustment.amount)}
                </p>
              ) : null}
            </div>
          ) : null}
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
              defaultStartMonth={defaultStartMonth}
              item={item}
              memberOptions={memberOptions}
            />

            {item.savingMode === "CUSTOM_SCHEDULE" ? (
              <div className="border-t border-[var(--color-line)] pt-4">
                <p className="text-sm font-semibold">Flexibel målplan</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                  Tillfälliga belopp gäller inom sin period. Därefter återgår
                  planen automatiskt till den takt som krävs för att nå målet.
                </p>

                <div className="mt-3 grid gap-1.5">
                  {item.savingRates.map((rate) => (
                    <div
                      key={rate.id}
                      className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.035] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium">
                          {formatMonthLabel(rate.startMonth)}
                          {rate.endMonth
                            ? ` – ${formatMonthLabel(rate.endMonth)}`
                            : " och framåt"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                          {formatCurrency(rate.monthlyAmount)}/mån
                        </p>
                      </div>
                      <form action={deleteAnnualSavingRateAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="rateId" value={rate.id} />
                        <FormStatusButton
                          className="icon-action-button icon-action-danger !h-8 !w-8"
                          pendingLabel=""
                          aria-label="Ta bort sparsteg"
                          title="Ta bort sparsteg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </FormStatusButton>
                      </form>
                    </div>
                  ))}
                </div>

                <form action={saveAnnualSavingRateAction} className="mt-3 grid gap-2.5">
                  <input type="hidden" name="itemId" value={item.id} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] text-[var(--color-muted)]">
                        Ny takt från
                      </span>
                      <input
                        name="startMonth"
                        type="month"
                        defaultValue={defaultStartMonth}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] text-[var(--color-muted)]">
                        Till och med
                      </span>
                      <input
                        name="endMonth"
                        type="month"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="mb-1.5 block text-[11px] text-[var(--color-muted)]">
                        Belopp per månad
                      </span>
                      <input
                        name="monthlyAmount"
                        inputMode="decimal"
                        placeholder="6000"
                        required
                      />
                    </label>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
                    Före milstolpen krävs ett slutdatum. Ett steg som börjar
                    efter milstolpen kan lämnas öppet för fortsatt sparande.
                  </p>
                  <FormStatusButton
                    className="action-secondary w-full justify-center"
                    pendingLabel="Sparar..."
                  >
                    Lägg till eller uppdatera steg
                  </FormStatusButton>
                </form>
              </div>
            ) : null}

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
          <p className="text-[10px] text-[var(--color-muted)]">
            {item.savingMode === "CUSTOM_SCHEDULE" ? "Planerat nu" : "Rekommenderat"}
          </p>
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
