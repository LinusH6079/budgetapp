import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { ModalLauncher } from "@/components/modal-launcher";
import { formatMonthLabel, getCurrentMonthKey } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { createMonthAction } from "@/server/actions/month-actions";
import { getMonthsForUser } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";

const MONTHS_PER_PAGE = 6;

type MonthsPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
    page?: string;
  }>;
};

export default async function MonthsPage({ searchParams }: MonthsPageProps) {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id);
  const { notice, error, page } = await searchParams;

  if (!household) {
    return (
      <div className="viewport-page">
        <FlashMessage notice={notice} error={error} />
        <HouseholdSetupCard />
      </div>
    );
  }

  const months = await getMonthsForUser(user.id);
  const latestMonth = months[0];
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const pageCount = Math.max(1, Math.ceil(months.length / MONTHS_PER_PAGE));
  const clampedPage = Math.min(currentPage, pageCount);
  const pageStart = (clampedPage - 1) * MONTHS_PER_PAGE;
  const visibleMonths = months.slice(pageStart, pageStart + MONTHS_PER_PAGE);

  return (
    <div className="viewport-page">
      <FlashMessage notice={notice} error={error} />

      <section className="app-panel flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Månader</h2>
          <span className="text-sm text-[var(--color-muted)]">{months.length}</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[var(--color-line)] bg-[var(--color-elevated)]">
          {visibleMonths.length > 0 ? (
            visibleMonths.map((month) => (
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

        {pageCount > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <Link
              href={clampedPage > 1 ? `/app/months?page=${clampedPage - 1}` : "/app/months?page=1"}
              className={`action-button action-secondary ${clampedPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              prefetch
            >
              <ChevronLeft className="h-4 w-4" />
              Föregående
            </Link>
            <span className="text-sm text-[var(--color-muted)]">
              {clampedPage}/{pageCount}
            </span>
            <Link
              href={
                clampedPage < pageCount ? `/app/months?page=${clampedPage + 1}` : `/app/months?page=${pageCount}`
              }
              className={`action-button action-secondary ${clampedPage >= pageCount ? "pointer-events-none opacity-50" : ""}`}
              prefetch
            >
              Nästa
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
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
    </div>
  );
}
