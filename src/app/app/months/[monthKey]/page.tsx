import { PayerType } from "@prisma/client";
import { notFound } from "next/navigation";

import { CategoryBreakdown } from "@/components/category-breakdown";
import { ExpenseList } from "@/components/expense-list";
import { FlashMessage } from "@/components/flash-message";
import { IncomeCarryOverForm } from "@/components/income-carry-over-form";
import { LockMonthButton } from "@/components/lock-month-button";
import { MonthNotesCard } from "@/components/month-notes-card";
import { MonthSelector } from "@/components/month-selector";
import { MonthSummaryCards } from "@/components/month-summary-cards";
import { WarningBanner } from "@/components/warning-banner";
import { formatMonthLabel } from "@/lib/date";
import { formatDateTime } from "@/lib/utils";
import { requireUser } from "@/lib/session";
import { createNextMonthAction } from "@/server/actions/month-actions";
import {
  filterExpenseItems,
  getMonthPageData,
  sortExpenseItems,
} from "@/server/services/budget-months";
import { mapMembersToSlots } from "@/server/services/households";

type MonthDetailPageProps = {
  params: Promise<{
    monthKey: string;
  }>;
  searchParams: Promise<{
    notice?: string;
    error?: string;
    status?: string;
    type?: string;
    planning?: string;
    category?: string;
    sort?: string;
  }>;
};

export default async function MonthDetailPage({
  params,
  searchParams,
}: MonthDetailPageProps) {
  const user = await requireUser();
  const { monthKey } = await params;
  const resolvedSearchParams = await searchParams;
  const pageData = await getMonthPageData(user.id, monthKey);

  if (!pageData) {
    notFound();
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (value) {
      query.set(key, value);
    }
  }

  const returnTo = `/app/months/${monthKey}${query.toString() ? `?${query.toString()}` : ""}`;
  const filters = {
    status: resolvedSearchParams.status ?? "all",
    type: resolvedSearchParams.type ?? "all",
    planning: resolvedSearchParams.planning ?? "all",
    category: resolvedSearchParams.category ?? "all",
    sort: resolvedSearchParams.sort ?? "dueDate",
  };

  const filteredExpenses = sortExpenseItems(
    filterExpenseItems(pageData.activeMonth.expenses, filters),
    filters.sort,
  );
  const categories = [...new Set(pageData.activeMonth.expenses.map((expense) => expense.category))].sort((a, b) =>
    a.localeCompare(b, "sv"),
  );
  const orderedMembers = mapMembersToSlots(pageData.household);

  const memberOptions = [
    {
      label: orderedMembers[0] ? `${orderedMembers[0].name} (Person 1)` : "Person 1",
      value: PayerType.FIRST_PERSON,
    },
    {
      label: orderedMembers[1] ? `${orderedMembers[1].name} (Person 2)` : "Person 2",
      value: PayerType.SECOND_PERSON,
    },
    {
      label: "Gemensamt",
      value: PayerType.SHARED,
    },
  ];

  const payerLabels: Record<PayerType, string> = {
    [PayerType.FIRST_PERSON]: memberOptions[0].label,
    [PayerType.SECOND_PERSON]: memberOptions[1].label,
    [PayerType.SHARED]: "Gemensamt",
  };

  const warnings: string[] = [];

  if (pageData.summary.remainingPlanned < 0) {
    warnings.push("Pengar kvar enligt plan är under noll.");
  }

  if (pageData.summary.remainingActual < 0) {
    warnings.push("Faktiskt kvar är under noll.");
  }

  if (pageData.summary.overdueExpensesCount > 0) {
    warnings.push("Det finns obetalda utgifter med förfallodatum i det förflutna.");
  }

  if (pageData.household.members.length < 2) {
    warnings.push("Hushållet har ännu bara en medlem.");
  }

  if (!pageData.nextMonth) {
    warnings.push("Nästa månad är inte skapad ännu.");
  }

  const dashboardSummary = {
    ...pageData.summary,
    unexplainedDifferenceFromPreviousMonth:
      pageData.previousSummary?.unexplainedDifferenceFromPreviousMonth ?? null,
  };

  return (
    <>
      <FlashMessage notice={resolvedSearchParams.notice} error={resolvedSearchParams.error} />

      <section className="app-panel px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Aktiv månad</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] capitalize">{formatMonthLabel(monthKey)}</h2>
            <p className="muted mt-2">
              Senast uppdaterad {formatDateTime(pageData.activeMonth.updatedAt)} av{" "}
              {pageData.activeMonth.updatedByUser?.name ?? "okänd"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <LockMonthButton monthId={pageData.activeMonth.id} returnTo={returnTo} isLocked={pageData.activeMonth.isLocked} />
            <form action={createNextMonthAction}>
              <input type="hidden" name="currentMonthKey" value={monthKey} />
              <button className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">
                Skapa nästa månad
              </button>
            </form>
          </div>
        </div>

        <div className="mt-5">
          <MonthSelector months={pageData.allMonths} activeMonthKey={monthKey} />
        </div>
      </section>

      <WarningBanner warnings={warnings} />

      <MonthSummaryCards summary={dashboardSummary} />

      <IncomeCarryOverForm
        monthId={pageData.activeMonth.id}
        returnTo={returnTo}
        isLocked={pageData.activeMonth.isLocked}
        personSnapshots={pageData.activeMonth.personSnapshots}
      />

      <ExpenseList
        monthId={pageData.activeMonth.id}
        returnTo={returnTo}
        isLocked={pageData.activeMonth.isLocked}
        expenses={filteredExpenses}
        memberOptions={memberOptions}
        payerLabels={payerLabels}
        currentFilters={filters}
        categories={categories}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBreakdown categories={pageData.summary.categories} />
        <MonthNotesCard
          monthId={pageData.activeMonth.id}
          note={pageData.activeMonth.note}
          returnTo={returnTo}
          isLocked={pageData.activeMonth.isLocked}
        />
      </div>
    </>
  );
}
