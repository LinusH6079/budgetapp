"use client";

import { ArrowRight, Info, Settings2 } from "lucide-react";
import { useState } from "react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { PendingLink } from "@/components/pending-link";
import { SpendingPaceProgress } from "@/components/spending-pace-progress";
import { SpendingPaceEntryList } from "@/components/spending-pace-entry-list";
import { formatMonthLabel } from "@/lib/date";
import { formatEditableAmount, formatCurrency } from "@/lib/money";
import type { CalendarDate } from "@/lib/pay-cycle";
import {
  saveCurrentWeekSpendingAction,
  saveSpendingPaceSettingsAction,
} from "@/server/actions/spending-pace-actions";

type SpendingPaceCardProps = {
  activeMonth?: {
    monthKey: string;
  };
  data: {
    settings: {
      monthlyLimit: number;
      weeklyLimit: number;
    } | null;
    weeklyTotals: Array<{
      weekStartKey: string;
      amount: number;
    }>;
    entries: Array<{
      id: string;
      amount: number;
      weekStartKey: string;
      createdAt: Date;
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
        startDate: CalendarDate;
        start: number;
        end: number;
      }>;
    };
    currentWeekAmount: number;
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

function getIsoWeekNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function SpendingPaceCard({ activeMonth, data }: SpendingPaceCardProps) {
  const settings = data.settings;
  const [showDetails, setShowDetails] = useState(false);

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
      <input
        type="hidden"
        name="weeklyLimit"
        value={settings ? formatEditableAmount(settings.weeklyLimit) : "1"}
      />
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
      {activeMonth ? (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow-label">Aktiv månad</p>
              <h2 className="mt-2 truncate text-xl font-semibold capitalize tracking-[-0.04em]">
                {formatMonthLabel(activeMonth.monthKey)}
              </h2>
            </div>
            <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)]">
              Aktiv
            </span>
          </div>

          <PendingLink
            href={`/app/months/${activeMonth.monthKey}`}
            prefetch
            className="action-button action-secondary mt-3 w-full justify-center"
          >
            Månadsbudget
            <ArrowRight className="h-4 w-4" />
          </PendingLink>
        </div>
      ) : null}

      <div
        className={`flex items-start justify-between gap-3 ${
          activeMonth
            ? "mt-4 border-t border-[var(--color-line)] pt-4"
            : ""
        }`}
      >
        <div>
          <p className="eyebrow-label">Lönepuls</p>
          {showDetails ? (
            <>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">
                {formatCalendarDate(data.cycle.startDate)} –{" "}
                {formatCalendarDate(data.cycle.endDate)}
              </h2>
              <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                Dag {data.cycle.elapsedDays} av {data.cycle.totalDays}
              </p>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className={`icon-action-button touch-feedback ${
              showDetails ? "bg-[var(--color-accent-soft)] text-white" : ""
            }`}
            aria-pressed={showDetails}
            aria-label={showDetails ? "Dölj detaljer" : "Visa detaljer"}
            title={showDetails ? "Dölj detaljer" : "Visa detaljer"}
          >
            <Info className="h-4 w-4" />
          </button>

          <ModalLauncher
            title="Lönebudget"
          description="Ställ in hur mycket ni har att använda till nästa lön."
            trigger={
              <span className="icon-action-button">
                <Settings2 className="h-4 w-4" />
              </span>
            }
          >
            {settingsForm}
          </ModalLauncher>
        </div>
      </div>

      {!settings ? (
        <div className="mt-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-4 py-4">
          <p className="text-sm font-semibold">Ställ in er lönebudget</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">
            Ange hur mycket ni vill kunna spendera fram till nästa lön.
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
            {showDetails ? (
              <div className="pb-1 text-right">
                <p className="text-[12px] text-[var(--color-muted)]">
                  Spenderat
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatCurrency(data.spent)} av{" "}
                  {formatCurrency(settings.monthlyLimit)}
                </p>
              </div>
            ) : null}
          </div>

          <SpendingPaceProgress
            cycle={data.cycle}
            monthlyLimit={settings.monthlyLimit}
            spent={data.spent}
            showDetails={showDetails}
          />

          <div className="mt-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3.5 py-3.5">
            <form
              action={saveCurrentWeekSpendingAction}
              className="flex items-end gap-2"
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

            <SpendingPaceEntryList
              entries={data.entries.map((entry) => ({
                id: entry.id,
                amount: entry.amount,
                weekStartKey: entry.weekStartKey,
                createdAt: entry.createdAt.toISOString(),
              }))}
            />

            {data.weeklyTotals.length > 0 ? (
              <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
                {data.weeklyTotals.map((entry) => (
                  <span
                    key={entry.weekStartKey}
                    className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[var(--color-muted)]"
                  >
                    Vecka {getIsoWeekNumber(entry.weekStartKey)} ·{" "}
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
