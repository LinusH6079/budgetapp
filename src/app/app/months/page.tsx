import Link from "next/link";
import { Plus } from "lucide-react";

import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { formatMonthLabel, getCurrentMonthKey } from "@/lib/date";
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

      <section className="app-panel px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-accent)]">Månadsval</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Välj månad</h2>
            <p className="muted mt-2">
              Här håller vi det enkelt. Öppna en månad för att låsa upp, ta bort eller jobba vidare med den.
            </p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-[var(--color-line)] overflow-hidden rounded-[26px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)]">
          {months.length > 0 ? (
            months.map((month) => (
              <Link
                key={month.id}
                href={`/app/months/${month.monthKey}`}
                className="flex items-center justify-between gap-3 px-4 py-4 transition hover:bg-white/4 sm:px-5"
              >
                <div>
                  <p className="text-base font-semibold capitalize">{formatMonthLabel(month.monthKey)}</p>
                  <p className="muted mt-1">{month.monthKey}</p>
                </div>
                <span className="text-sm text-[var(--color-muted)]">Öppna</span>
              </Link>
            ))
          ) : (
            <div className="px-4 py-8 text-sm text-[var(--color-muted)] sm:px-5">
              Inga månader ännu. Skapa er första med plusknappen.
            </div>
          )}
        </div>
      </section>

      <section id="new-month" className="app-panel scroll-mt-24 px-5 py-5 sm:px-6 lg:scroll-mt-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="section-title">Ny månad</h3>
            <p className="muted mt-2">
              Skapa en ny månad manuellt och kopiera gärna återkommande utgifter från senaste månaden.
            </p>
          </div>
        </div>

        <form action={createMonthAction} className="mt-5 grid gap-3 sm:max-w-xl">
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
          <FormStatusButton className="action-primary mt-1 w-full sm:w-fit" pendingLabel="Skapar månad...">
            Skapa månad
          </FormStatusButton>
        </form>
      </section>

      <a
        href="#new-month"
        className="fixed bottom-6 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-accent-strong),var(--color-accent))] text-[#021412] shadow-[0_20px_45px_rgba(31,214,193,0.28)] transition hover:scale-[1.03] sm:right-6 lg:bottom-8"
        aria-label="Lägg till ny månad"
      >
        <Plus className="h-6 w-6" />
      </a>
    </>
  );
}
