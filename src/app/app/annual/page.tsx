import { Plus } from "lucide-react";

import { AnnualBudgetForm } from "@/components/annual-budget-form";
import { AnnualBudgetItemCard } from "@/components/annual-budget-item-card";
import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { ModalLauncher } from "@/components/modal-launcher";
import { getCurrentMonthKey } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getAnnualBudgetForUser } from "@/server/services/annual-budget";
import { getMonthsForUser } from "@/server/services/budget-months";
import {
  getHouseholdForUser,
  mapMembersToSlots,
} from "@/server/services/households";

type AnnualBudgetPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

function defaultDueMonth() {
  const [year, month] = getCurrentMonthKey().split("-").map(Number);
  return `${year + 1}-${String(month).padStart(2, "0")}`;
}

export default async function AnnualBudgetPage({
  searchParams,
}: AnnualBudgetPageProps) {
  const user = await requireUser();
  const { notice, error } = await searchParams;
  const [household, annualBudget, allMonths] = await Promise.all([
    getHouseholdForUser(user.id),
    getAnnualBudgetForUser(user.id),
    getMonthsForUser(user.id),
  ]);

  if (!household || !annualBudget) {
    return (
      <div className="viewport-page">
        <FlashMessage notice={notice} error={error} />
        <HouseholdSetupCard />
      </div>
    );
  }

  const dueMonth = defaultDueMonth();
  const months = allMonths
    .filter((month) => !month.isLocked)
    .sort((left, right) => right.monthKey.localeCompare(left.monthKey))
    .map((month) => ({
      id: month.id,
      monthKey: month.monthKey,
    }));
  const memberOptions = mapMembersToSlots(household).map((member) => ({
    label: member.name,
    value: member.slot,
  }));
  const coverage =
    annualBudget.totalTarget > 0
      ? Math.min(
          100,
          (annualBudget.totalReserved / annualBudget.totalTarget) * 100,
        )
      : 0;

  return (
    <div className="viewport-page">
      <FlashMessage notice={notice} error={error} />

      <section className="app-panel px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow-label">Årsbudget</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">
              Framtida kostnader
            </h2>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
              Pengar som är reserverade men fortfarande finns kvar på kontot.
            </p>
          </div>

          <ModalLauncher
            title="Ny årskostnad"
            description="Skapa ett mål och låt appen räkna ut ett månadssparande."
            trigger={
              <span className="icon-action-button action-primary">
                <Plus className="h-4 w-4" />
              </span>
            }
            dialogClassName="sm:max-w-md"
          >
            <AnnualBudgetForm defaultDueMonth={dueMonth} />
          </ModalLauncher>
        </div>

        <div className="mt-4 rounded-[20px] bg-[var(--color-elevated)] px-4 py-4">
          <p className="eyebrow-label">Reserverat totalt</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="text-[1.9rem] font-semibold tracking-[-0.05em]">
              {formatCurrency(annualBudget.totalReserved)}
            </p>
            <p className="pb-1 text-xs text-[var(--color-muted)]">
              av {formatCurrency(annualBudget.totalTarget)}
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[var(--color-accent-strong)]"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="stat-tile">
            <p className="eyebrow-label">Kvar denna månad</p>
            <p className="stat-value">
              {formatCurrency(annualBudget.remainingRecommendedThisMonth)}
            </p>
            <p className="mt-1 text-[9px] text-[var(--color-muted)]">
              {formatCurrency(annualBudget.contributedThisMonth)} insatt
            </p>
          </div>
          <div className="stat-tile">
            <p className="eyebrow-label">Aktiva mål</p>
            <p className="stat-value">{annualBudget.items.length} st</p>
          </div>
        </div>
      </section>

      <section className="app-panel px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title">Årskostnader</h2>
          <span className="text-[11px] text-[var(--color-muted)]">
            Närmast först
          </span>
        </div>

        {annualBudget.items.length > 0 ? (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {annualBudget.items.map((item) => (
              <AnnualBudgetItemCard
                key={item.id}
                item={item}
                defaultDueMonth={dueMonth}
                months={months}
                memberOptions={memberOptions}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] bg-[var(--color-elevated)] px-4 py-7 text-center">
            <p className="text-sm font-semibold">Inga årskostnader ännu</p>
            <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--color-muted)]">
              Lägg till exempelvis bilservice, försäkring eller semester med plusknappen ovan.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
