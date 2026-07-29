import { RotateCcw, Settings2 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { formatEditableAmount, formatCurrency } from "@/lib/money";
import type { CalendarDate } from "@/lib/pay-cycle";
import {
  saveCurrentWeekSpendingAction,
  saveSpendingPaceSettingsAction,
  undoLatestCurrentWeekSpendingAction,
} from "@/server/actions/spending-pace-actions";

type SpendingPaceCardProps = {
  data: {
    settings: {
      monthlyLimit: number;
      weeklyLimit: number;
    } | null;
    weeklyTotals: Array<{
      weekStartKey: string;
      amount: number;
    }>;
    cycle: {
      startDate: CalendarDate;
      endDate: CalendarDate;
      totalDays: number;
      elapsedDays: number;
      expectedFraction: number;
      ticks: Array<{
        position: number;
        isWeekBoundary: boolean;
      }>;
      weeks: Array<{
        label: string;
        start: number;
        end: number;
      }>;
    };
    currentWeekAmount: number;
    latestCurrentWeekAddition: number | null;
    spent: number;
    remaining: number | null;
    weekRemaining: number | null;
  };
};

function formatCalendarDate(date: CalendarDate) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

function formatWeekStart(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return formatCalendarDate({ year, month, day });
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

function markerTransform(percentage: number) {
  if (percentage < 18) {
    return "translateX(0)";
  }

  if (percentage > 82) {
    return "translateX(-100%)";
  }

  return "translateX(-50%)";
}

export function SpendingPaceCard({ data }: SpendingPaceCardProps) {
  const settings = data.settings;
  const actualPercentage = settings
    ? (data.spent / settings.monthlyLimit) * 100
    : 0;
  const expectedPercentage = data.cycle.expectedFraction * 100;
  const expectedAmount = settings
    ? Math.round(settings.monthlyLimit * data.cycle.expectedFraction)
    : 0;
  const paceDifference = expectedAmount - data.spent;
  const weekPercentage = settings
    ? (data.currentWeekAmount / settings.weeklyLimit) * 100
    : 0;
  const isOverMonthlyLimit = Boolean(
    settings && data.spent > settings.monthlyLimit,
  );
  const isOverWeeklyLimit = Boolean(
    settings && data.currentWeekAmount > settings.weeklyLimit,
  );

  const settingsForm = (
    <form action={saveSpendingPaceSettingsAction} className="grid gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Fick- och matpengar per löneperiod
        </span>
        <input
          name="monthlyLimit"
          inputMode="decimal"
          defaultValue={
            settings ? formatEditableAmount(settings.monthlyLimit) : ""
          }
          placeholder="12000"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Riktmärke per vecka
        </span>
        <input
          name="weeklyLimit"
          inputMode="decimal"
          defaultValue={
            settings ? formatEditableAmount(settings.weeklyLimit) : ""
          }
          placeholder="3000"
          required
        />
      </label>
      <p className="text-[12px] leading-relaxed text-[var(--color-muted)]">
        Löneperioden startar den 25:e, eller på fredagen före om den 25:e
        infaller på en helg.
      </p>
      <FormStatusButton
        className="action-primary w-full justify-center"
        pendingLabel="Sparar..."
      >
        Spara lönebudget
      </FormStatusButton>
    </form>
  );

  return (
    <section className="app-panel px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow-label">Lönepuls</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">
            {formatCalendarDate(data.cycle.startDate)} –{" "}
            {formatCalendarDate(data.cycle.endDate)}
          </h2>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
            Dag {data.cycle.elapsedDays} av {data.cycle.totalDays}
          </p>
        </div>

        <ModalLauncher
          title="Lönebudget"
          description="Ställ in periodens och veckans riktmärken."
          trigger={
            <span className="icon-action-button">
              <Settings2 className="h-4 w-4" />
            </span>
          }
        >
          {settingsForm}
        </ModalLauncher>
      </div>

      {!settings ? (
        <div className="mt-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-4 py-4">
          <p className="text-sm font-semibold">Ställ in er lönebudget</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">
            Ange hur mycket ni vill kunna spendera per löneperiod och vecka.
          </p>
          <ModalLauncher
            title="Lönebudget"
            description="Beloppen kan ändras när som helst."
            trigger={
              <span className="action-button action-primary mt-3">
                Kom igång
              </span>
            }
          >
            {settingsForm}
          </ModalLauncher>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] text-[var(--color-muted)]">
                Kvar till nästa lön
              </p>
              <p
                className={`mt-1 text-[1.8rem] font-semibold tracking-[-0.05em] ${
                  (data.remaining ?? 0) < 0
                    ? "text-[var(--color-danger)]"
                    : ""
                }`}
              >
                {formatCurrency(data.remaining ?? 0)}
              </p>
            </div>
            <div className="pb-1 text-right">
              <p className="text-[12px] text-[var(--color-muted)]">
                Spenderat
              </p>
              <p className="mt-1 text-sm font-semibold">
                {formatCurrency(data.spent)} av{" "}
                {formatCurrency(settings.monthlyLimit)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex h-5 overflow-hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
              {data.cycle.weeks.map((week) => (
                <span
                  key={`${week.label}-${week.start}`}
                  className="flex items-center justify-center border-l border-white/20 first:border-l-0"
                  style={{ width: `${week.end - week.start}%` }}
                >
                  {week.label}
                </span>
              ))}
            </div>

            <div className="relative mt-1 h-[70px]">
              <div
                className="absolute top-0 z-30"
                style={{
                  left: `${clampPercentage(actualPercentage)}%`,
                  transform: markerTransform(actualPercentage),
                }}
              >
                <span
                  className={`block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                    isOverMonthlyLimit
                      ? "bg-[#ef4444] text-white"
                      : "bg-[#6ee7b7] text-[#07120e]"
                  }`}
                >
                  Spenderat {formatCurrency(data.spent)}
                </span>
              </div>
              <span
                className={`absolute top-4 z-20 h-[45px] w-0.5 ${
                  isOverMonthlyLimit ? "bg-[#ef4444]" : "bg-[#6ee7b7]"
                }`}
                style={{ left: `${clampPercentage(actualPercentage)}%` }}
                aria-hidden="true"
              />

              <div
                className="absolute top-7 z-30"
                style={{
                  left: `${clampPercentage(expectedPercentage)}%`,
                  transform: markerTransform(expectedPercentage),
                }}
              >
                <span className="block whitespace-nowrap rounded-md border border-white/15 bg-[#282828] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  Idag {formatCurrency(expectedAmount)}
                </span>
              </div>
              <span
                className="absolute top-[42px] z-20 h-[17px] w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.25)]"
                style={{ left: `${clampPercentage(expectedPercentage)}%` }}
                aria-hidden="true"
              />

              <div className="absolute inset-x-0 bottom-0 h-7 overflow-hidden rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.035)]">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${
                    isOverMonthlyLimit
                      ? "bg-[rgba(239,68,68,0.52)]"
                      : "bg-[rgba(167,243,208,0.42)]"
                  }`}
                  style={{ width: `${clampPercentage(actualPercentage)}%` }}
                />

                {data.cycle.ticks.map((tick) => (
                  <span
                    key={`${tick.position}-${tick.isWeekBoundary}`}
                    className={`absolute bottom-0 top-0 z-10 w-px ${
                      tick.isWeekBoundary
                        ? "w-0.5 bg-white/55"
                        : "!top-2 bg-white/20"
                    }`}
                    style={{ left: `${tick.position}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>

            <p
              className={`mt-2 text-[12px] font-medium ${
                paceDifference < 0
                  ? "text-[var(--color-danger)]"
                  : "text-[#86efac]"
              }`}
            >
              {paceDifference >= 0
                ? `${formatCurrency(paceDifference)} under dagens takt`
                : `${formatCurrency(Math.abs(paceDifference))} över dagens takt`}
            </p>
          </div>

          <div className="mt-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3.5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Den här veckan</p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  {formatCurrency(data.currentWeekAmount)} spenderat ·{" "}
                  {formatCurrency(data.weekRemaining ?? 0)} kvar
                </p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  isOverWeeklyLimit ? "text-[var(--color-danger)]" : ""
                }`}
              >
                {formatCurrency(settings.weeklyLimit)}
              </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${
                  isOverWeeklyLimit ? "bg-[#ef4444]" : "bg-[#a7f3d0]"
                }`}
                style={{ width: `${clampPercentage(weekPercentage)}%` }}
              />
            </div>

            <form
              action={saveCurrentWeekSpendingAction}
              className="mt-3 flex items-end gap-2"
            >
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-[11px] font-medium text-[var(--color-muted)]">
                  Lägg till spenderat
                </span>
                <input
                  name="amount"
                  inputMode="decimal"
                  defaultValue=""
                  placeholder="0"
                  required
                />
              </label>
              <FormStatusButton
                className="action-primary h-[46px] shrink-0 justify-center px-4"
                pendingLabel=""
                aria-label="Lägg till veckobelopp"
              >
                Lägg till
              </FormStatusButton>
            </form>

            {data.latestCurrentWeekAddition !== null ? (
              <form
                action={undoLatestCurrentWeekSpendingAction}
                className="mt-2"
              >
                <FormStatusButton
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-[var(--color-muted)] transition-colors hover:bg-white/5 hover:text-white"
                  pendingLabel="Ångrar..."
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Ångra senaste +{formatCurrency(data.latestCurrentWeekAddition)}
                </FormStatusButton>
              </form>
            ) : null}

            {data.weeklyTotals.length > 0 ? (
              <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
                {data.weeklyTotals.map((entry) => (
                  <span
                    key={entry.weekStartKey}
                    className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[var(--color-muted)]"
                  >
                    {formatWeekStart(entry.weekStartKey)} ·{" "}
                    {formatCurrency(entry.amount)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
