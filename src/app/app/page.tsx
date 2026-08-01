import { ArrowRight } from "lucide-react";

import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { PendingLink } from "@/components/pending-link";
import { SpendingPaceCard } from "@/components/spending-pace-card";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getAnnualBudgetForUser } from "@/server/services/annual-budget";
import { getLatestMonthKeyForUser, getMonthPageData } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";
import { getSpendingPaceForUser } from "@/server/services/spending-pace";

type AppHomePageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

function AnnualOverviewCard({
  totalReserved,
  remainingThisMonth,
  activeCount,
  nextItem,
}: {
  totalReserved: number;
  remainingThisMonth: number;
  activeCount: number;
  nextItem: { name: string; dueMonth: string } | null;
}) {
  return (
    <section className="app-panel px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow-label">Årsbudget</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">
            {formatCurrency(totalReserved)} reserverat
          </h2>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {activeCount > 0
              ? remainingThisMonth > 0
                ? `${formatCurrency(remainingThisMonth)} kvar att reservera den här månaden`
                : "Månadens rekommenderade sparande är klart"
              : "Skapa mål för större framtida kostnader"}
          </p>
        </div>
        <PendingLink
          href="/app/annual"
          prefetch
          className="icon-action-button"
          aria-label="Öppna årsbudget"
        >
          <ArrowRight className="h-4 w-4" />
        </PendingLink>
      </div>

      {nextItem ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] bg-[var(--color-elevated)] px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Nästa kostnad
            </p>
            <p className="mt-1 truncate text-sm font-semibold">{nextItem.name}</p>
          </div>
          <span className="shrink-0 text-xs capitalize text-[var(--color-muted)]">
            {formatMonthLabel(nextItem.dueMonth)}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export default async function AppHomePage({ searchParams }: AppHomePageProps) {
  const user = await requireUser();
  const { notice, error } = await searchParams;
  const [household, latestMonthKey, spendingPace, annualBudget] = await Promise.all([
    getHouseholdForUser(user.id),
    getLatestMonthKeyForUser(user.id),
    getSpendingPaceForUser(user.id),
    getAnnualBudgetForUser(user.id),
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
          <p className="eyebrow-label">Översikt</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Ingen månad ännu</h2>
          <p className="muted mt-2">Gå till månader för att skapa första månaden.</p>
        </section>
        {spendingPace ? <SpendingPaceCard data={spendingPace} /> : null}
        {annualBudget ? (
          <AnnualOverviewCard
            totalReserved={annualBudget.totalReserved}
            remainingThisMonth={annualBudget.remainingRecommendedThisMonth}
            activeCount={annualBudget.items.length}
            nextItem={annualBudget.nextItem}
          />
        ) : null}
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

  return (
    <div className="viewport-page">
      <FlashMessage notice={notice} error={error} />

      {spendingPace ? (
        <SpendingPaceCard
          data={spendingPace}
          activeMonth={{
            monthKey: pageData.activeMonth.monthKey,
          }}
        />
      ) : null}

      {annualBudget ? (
        <AnnualOverviewCard
          totalReserved={annualBudget.totalReserved}
          remainingThisMonth={annualBudget.remainingRecommendedThisMonth}
          activeCount={annualBudget.items.length}
          nextItem={annualBudget.nextItem}
        />
      ) : null}
    </div>
  );
}
