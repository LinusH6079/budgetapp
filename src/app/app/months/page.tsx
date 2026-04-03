import Link from "next/link";
import { Plus } from "lucide-react";

import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { ModalLauncher } from "@/components/modal-launcher";
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

      <section className="app-panel px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Månader</h2>
          <span className="text-sm text-[var(--color-muted)]">{months.length}</span>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-[var(--color-line)] bg-[var(--color-elevated)]">
          {months.length > 0 ? (
            months.map((month) => (
              <Link
                key={month.id}
                href={`/app/months/${month.monthKey}`}
                prefetch
                className="content-auto flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-4 transition hover:bg-white/4 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-semibold capitalize">{formatMonthLabel(month.monthKey)}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{month.monthKey}</p>
                </div>
                <span className="text-sm text-[var(--color-muted)]">Öppna</span>
              </Link>
            ))
          ) : (
            <div className="px-4 py-8 text-sm text-[var(--color-muted)]">Inga månader.</div>
          )}
        </div>
      </section>

      <ModalLauncher
        title="Ny månad"
        trigger={
          <span className="floating-action-button">
            <Plus className="h-6 w-6" />
          </span>
        }
        triggerClassName="fixed bottom-6 right-4 z-30 sm:right-6 lg:bottom-8"
      >
        <form action={createMonthAction} className="grid gap-3">
          <input type="hidden" name="returnTo" value="/app/months" />
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Månad</span>
            <input name="monthKey" defaultValue={getCurrentMonthKey()} placeholder="2026-04" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Kopiera från</span>
            <select name="copyRecurringFromMonthId" defaultValue={latestMonth?.id ?? ""}>
              <option value="">Ingen</option>
              {months.map((month) => (
                <option key={month.id} value={month.id}>
                  {month.monthKey}
                </option>
              ))}
            </select>
          </label>
          <FormStatusButton className="action-primary mt-1 w-full justify-center" pendingLabel="Skapar...">
            Skapa
          </FormStatusButton>
        </form>
      </ModalLauncher>
    </>
  );
}
