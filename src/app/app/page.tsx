import Link from "next/link";
import { ArrowRight, CircleAlert, Coins, Receipt, Wallet } from "lucide-react";

import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import {
  getLatestMonthKeyForUser,
  getMonthPageData,
} from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";

type AppHomePageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

function OverviewStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--color-danger)]"
      : tone === "accent"
        ? "text-[var(--color-ink)]"
        : "text-[var(--color-muted)]";

  return (
    <div className="rounded-[18px] bg-[var(--color-elevated)] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1.5 text-base font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default async function AppHomePage({ searchParams }: AppHomePageProps) {
  const user = await requireUser();
  const { notice, error } = await searchParams;
  const [household, latestMonthKey] = await Promise.all([
    getHouseholdForUser(user.id),
    getLatestMonthKeyForUser(user.id),
  ]);

  if (!household) {
    return (
      <div className="viewport-page">
        <FlashMessage notice={notice} error={error} />
        <HouseholdSetupCard />
      </div>
    );
  }

  if (!latestMonthKey) {
    return (
      <div className="viewport-page">
        <FlashMessage notice={notice} error={error} />
        <section className="app-panel px-4 py-5 sm:px-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Översikt</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Ingen månad ännu</h2>
          <p className="muted mt-2">Skapa första månaden för att börja följa hushållets budget.</p>
          <Link href="/app/months" className="action-button action-primary mt-5 w-fit" prefetch>
            Gå till månader
          </Link>
        </section>
      </div>
    );
  }

  const pageData = await getMonthPageData(user.id, latestMonthKey);

  if (!pageData) {
    return (
      <div className="viewport-page">
        <FlashMessage notice={notice} error={error} />
      </div>
    );
  }

  const summary = pageData.summary;
  const unexplained = pageData.previousSummary?.unexplainedDifferenceFromPreviousMonth ?? null;
  const activeMonthHref = `/app/months/${latestMonthKey}?tab=month`;
  const incomeHref = `/app/months/${latestMonthKey}?tab=income`;
  const expensesHref = `/app/months/${latestMonthKey}?tab=expenses`;

  return (
    <div className="viewport-page">
      <FlashMessage notice={notice} error={error} />

      <section className="app-panel px-4 py-5 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Översikt</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              {formatMonthLabel(pageData.activeMonth.monthKey)}
            </h2>
          </div>
          <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)]">
            {pageData.activeMonth.isLocked ? "Låst" : "Öppen"}
          </span>
        </div>

        <div className="mt-5 rounded-[22px] bg-[var(--color-elevated)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--color-accent-soft)] p-2.5 text-[var(--color-ink)]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">Kvar just nu</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.05em]">
                {formatCurrency(summary.remainingActual)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <OverviewStat label="Tillgängligt" value={formatCurrency(summary.totalAvailable)} tone="accent" />
          <OverviewStat
            label="Planerat kvar"
            value={formatCurrency(summary.remainingPlanned)}
            tone={summary.remainingPlanned < 0 ? "danger" : "default"}
          />
          <OverviewStat label="Obetalda" value={`${summary.unpaidCount} st`} />
          <OverviewStat
            label="Oförklarat"
            value={unexplained === null ? "Ingen data" : formatCurrency(unexplained)}
            tone={unexplained && unexplained > 0 ? "danger" : "default"}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href={activeMonthHref} className="app-panel px-4 py-4" prefetch>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Månad</p>
              <p className="muted mt-1">Byt månad, lås och skapa nästa.</p>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
        </Link>

        <Link href={incomeHref} className="app-panel px-4 py-4" prefetch>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Inkomst</p>
              <p className="muted mt-1">Uppdatera inkomst och carry-over.</p>
            </div>
            <Coins className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
        </Link>

        <Link href={expensesHref} className="app-panel px-4 py-4" prefetch>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Utgifter</p>
              <p className="muted mt-1">Snabb tillgång till listan och betalstatus.</p>
            </div>
            <Receipt className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
        </Link>

        <Link href="/app/household" className="app-panel px-4 py-4" prefetch>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Mer</p>
              <p className="muted mt-1">Hushåll, invite, export och import.</p>
            </div>
            <CircleAlert className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
        </Link>
      </section>
    </div>
  );
}
