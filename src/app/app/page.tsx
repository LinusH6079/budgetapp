import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { SpendingPaceCard } from "@/components/spending-pace-card";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getLatestMonthKeyForUser, getMonthPageData } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";
import { getSpendingPaceForUser } from "@/server/services/spending-pace";

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
    <div className="stat-tile">
      <p className="eyebrow-label">{label}</p>
      <p className={`stat-value ${toneClass}`}>{value}</p>
    </div>
  );
}

export default async function AppHomePage({ searchParams }: AppHomePageProps) {
  const user = await requireUser();
  const { notice, error } = await searchParams;
  const [household, latestMonthKey, spendingPace] = await Promise.all([
    getHouseholdForUser(user.id),
    getLatestMonthKeyForUser(user.id),
    getSpendingPaceForUser(user.id),
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
        {spendingPace ? <SpendingPaceCard data={spendingPace} /> : null}
        <section className="app-panel px-4 py-5 sm:px-5">
          <p className="eyebrow-label">Översikt</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Ingen månad ännu</h2>
          <p className="muted mt-2">Gå till månader för att skapa första månaden.</p>
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

  return (
    <div className="viewport-page">
      <FlashMessage notice={notice} error={error} />
      {spendingPace ? <SpendingPaceCard data={spendingPace} /> : null}

      <section className="app-panel px-4 py-5 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label">Översikt</p>
            <h2 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.05em]">Aktiv månad</h2>
          </div>
          <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)]">
            {formatMonthLabel(pageData.activeMonth.monthKey)}
          </span>
        </div>

        <div className="mt-5 rounded-[20px] bg-[var(--color-elevated)] px-4 py-4">
          <p className="eyebrow-label">Kvar just nu</p>
          <p className="mt-1 text-[2rem] font-semibold tracking-[-0.05em]">{formatCurrency(summary.remainingActual)}</p>
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
            label="Utgifter som ej blev loggade"
            value={unexplained === null ? "Ingen data" : formatCurrency(unexplained)}
            tone={unexplained && unexplained > 0 ? "danger" : "default"}
          />
        </div>
      </section>
    </div>
  );
}
