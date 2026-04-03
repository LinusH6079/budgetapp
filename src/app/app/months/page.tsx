import Link from "next/link";

import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { MonthSelector } from "@/components/month-selector";
import { getCurrentMonthKey } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { createMonthAction } from "@/server/actions/month-actions";
import { getMonthsForUser } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";

type MonthsPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function MonthsPage({ searchParams }: MonthsPageProps) {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id);
  const { notice, error } = await searchParams;

  if (!household) {
    return (
      <>
        <FlashMessage notice={notice} error={error} />
        <HouseholdSetupCard />
      </>
    );
  }

  const months = await getMonthsForUser(user.id);
  const latestMonth = months[0];

  return (
    <>
      <FlashMessage notice={notice} error={error} />
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="app-panel px-5 py-5 sm:px-6">
          <h2 className="section-title">Skapa ny månad</h2>
          <p className="muted mt-2">
            Du kan skapa en ny månad manuellt eller kopiera återkommande utgifter från senaste månaden.
          </p>

          <form action={createMonthAction} className="mt-5 space-y-3">
            <input type="hidden" name="returnTo" value="/app/months" />
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Månadskod</span>
              <input name="monthKey" defaultValue={getCurrentMonthKey()} placeholder="2026-04" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Kopiera återkommande från</span>
              <select name="copyRecurringFromMonthId" defaultValue={latestMonth?.id ?? ""}>
                <option value="">Ingen kopiering</option>
                {months.map((month) => (
                  <option key={month.id} value={month.id}>
                    {month.monthKey}
                  </option>
                ))}
              </select>
            </label>
            <FormStatusButton className="action-primary" pendingLabel="Skapar månad...">
              Skapa månad
            </FormStatusButton>
          </form>
        </div>

        <div className="app-panel px-5 py-5 sm:px-6">
          <h2 className="section-title">Alla månader</h2>
          <div className="mt-4">
            <MonthSelector months={months} />
          </div>
          <div className="mt-5 grid gap-3">
            {months.map((month) => (
              <Link key={month.id} href={`/app/months/${month.monthKey}`} className="surface-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{month.monthKey}</p>
                    <p className="muted mt-1">Uppdaterad {month.updatedAt.toLocaleDateString("sv-SE")}</p>
                  </div>
                  <span className="pill-tag bg-[var(--color-panel-strong)]">
                    {month.isLocked ? "Låst" : "Öppen"}
                  </span>
                </div>
              </Link>
            ))}
            {months.length === 0 ? (
              <p className="surface-card text-sm text-[var(--color-muted)]">
                Inga månader ännu. Skapa er första ovan.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
