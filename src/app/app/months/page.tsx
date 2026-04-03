import Link from "next/link";
import { ChevronRight, Lock, LockOpen, Plus } from "lucide-react";

import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { ModalLauncher } from "@/components/modal-launcher";
import { MonthOverflowActions } from "@/components/month-overflow-actions";
import { compareMonthKeys, formatMonthLabel, getCurrentMonthKey } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { createMonthAction } from "@/server/actions/month-actions";
import { getLatestMonthKeyForUser, getMonthsForUser } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";

const MONTHS_PER_PAGE = 8;

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
  const latestMonthKey = await getLatestMonthKeyForUser(user.id);
  const { notice, error, page } = await searchParams;

  if (!household) {
    return (
      <div className="viewport-page">
        <FlashMessage notice={notice} error={error} />
        <HouseholdSetupCard />
      </div>
    );
  }

  const months = (await getMonthsForUser(user.id)).sort((a, b) => compareMonthKeys(b.monthKey, a.monthKey));
  const latestMonth = months[0];
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const pageCount = Math.max(1, Math.ceil(months.length / MONTHS_PER_PAGE));
  const clampedPage = Math.min(currentPage, pageCount);
  const pageStart = (clampedPage - 1) * MONTHS_PER_PAGE;
  const visibleMonths = months.slice(pageStart, pageStart + MONTHS_PER_PAGE);

  return (
    <div className="viewport-page">
      <FlashMessage notice={notice} error={error} />

      <section className="app-panel px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow-label">Månader</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Alla månader</h2>
          </div>

          <ModalLauncher
            title="Ny månad"
            description="Skapa en ny månad och kopiera återkommande poster om du vill."
            trigger={
              <span className="icon-action-button action-primary">
                <Plus className="h-4 w-4" />
              </span>
            }
            dialogClassName="sm:max-w-xl"
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
                Skapa månad
              </FormStatusButton>
            </form>
          </ModalLauncher>
        </div>

        <div className="grid gap-2.5">
          {visibleMonths.length > 0 ? (
            visibleMonths.map((month) => {
              const isActive = month.monthKey === latestMonthKey;

              return (
                <article
                  key={month.id}
                  className={`rounded-[18px] border px-3.5 py-3 ${
                    isActive
                      ? "border-[var(--color-accent-strong)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] bg-[var(--color-elevated)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Link href={`/app/months/${month.monthKey}`} className="min-w-0 flex-1" prefetch>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold capitalize">{formatMonthLabel(month.monthKey)}</p>
                        {isActive ? (
                          <span className="rounded-full bg-[var(--color-panel)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink)]">
                            Aktiv
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
                        {month.isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                        <span>{month.isLocked ? "Låst" : "Öppen"}</span>
                      </div>
                    </Link>

                    <Link href={`/app/months/${month.monthKey}`} className="icon-action-button" prefetch>
                      <ChevronRight className="h-4 w-4" />
                    </Link>

                    <MonthOverflowActions
                      monthId={month.id}
                      monthKey={month.monthKey}
                      isLocked={month.isLocked}
                      returnTo="/app/months"
                    />
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[18px] bg-[var(--color-elevated)] px-4 py-8 text-sm text-[var(--color-muted)]">
              Inga månader ännu.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
