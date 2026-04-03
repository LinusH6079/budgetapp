import { PayerType } from "@prisma/client";
import { ArrowLeft, Lock, LockOpen, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryBreakdown } from "@/components/category-breakdown";
import { DeleteMonthButton } from "@/components/delete-month-button";
import { ExpenseList } from "@/components/expense-list";
import { ExpenseForm } from "@/components/expense-form";
import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { IncomeCarryOverForm } from "@/components/income-carry-over-form";
import { LockMonthButton } from "@/components/lock-month-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { MonthNotesCard } from "@/components/month-notes-card";
import { MonthSummaryCards } from "@/components/month-summary-cards";
import { WarningBanner } from "@/components/warning-banner";
import { formatMonthLabel } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
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
    payer?: string;
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
    payer: resolvedSearchParams.payer ?? "all",
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
    warnings.push("Plan kvar under noll.");
  }

  if (pageData.summary.remainingActual < 0) {
    warnings.push("Faktiskt kvar under noll.");
  }

  if (pageData.summary.overdueExpensesCount > 0) {
    warnings.push("Det finns försenade obetalda poster.");
  }

  if (pageData.household.members.length < 2) {
    warnings.push("Hushållet saknar person 2.");
  }

  if (!pageData.nextMonth) {
    warnings.push("Nästa månad saknas.");
  }

  const dashboardSummary = {
    ...pageData.summary,
    unexplainedDifferenceFromPreviousMonth:
      pageData.previousSummary?.unexplainedDifferenceFromPreviousMonth ?? null,
  };

  return (
    <>
      <FlashMessage notice={resolvedSearchParams.notice} error={resolvedSearchParams.error} />

      <section id="month-top" className="app-panel px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] capitalize">
                {formatMonthLabel(monthKey)}
              </h2>
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${
                  pageData.activeMonth.isLocked
                    ? "border-[var(--color-line)] bg-[var(--color-elevated)] text-[var(--color-muted)]"
                    : "border-[var(--color-line)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                }`}
                title={pageData.activeMonth.isLocked ? "Låst" : "Öppen"}
                aria-label={pageData.activeMonth.isLocked ? "Låst" : "Öppen"}
              >
                {pageData.activeMonth.isLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              </span>
            </div>
            <p className="muted mt-2">{formatDateTime(pageData.activeMonth.updatedAt)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/months"
              className="action-button action-secondary"
              prefetch
              aria-label="Tillbaka till månader"
              title="Tillbaka till månader"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <LockMonthButton
              monthId={pageData.activeMonth.id}
              returnTo={returnTo}
              isLocked={pageData.activeMonth.isLocked}
            />
            <DeleteMonthButton
              monthId={pageData.activeMonth.id}
              monthKey={monthKey}
              returnTo={returnTo}
            />
            <form action={createNextMonthAction}>
              <input type="hidden" name="currentMonthKey" value={monthKey} />
              <FormStatusButton
                className="icon-action-button action-primary"
                pendingLabel=""
                aria-label="Skapa nästa månad"
                title="Skapa nästa månad"
              >
                <Plus className="h-4 w-4" />
              </FormStatusButton>
            </form>
          </div>
        </div>
      </section>

      <section id="month-status">
        <WarningBanner warnings={warnings} />
      </section>

      <section id="month-summary">
        <MonthSummaryCards summary={dashboardSummary} />
      </section>

      <section id="month-household">
        <IncomeCarryOverForm
          monthId={pageData.activeMonth.id}
          returnTo={returnTo}
          isLocked={pageData.activeMonth.isLocked}
          personSnapshots={pageData.activeMonth.personSnapshots}
        />
      </section>

      <section id="month-expenses">
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
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section id="month-categories">
          <CategoryBreakdown categories={pageData.summary.categories} />
        </section>
        <section id="month-notes">
          <MonthNotesCard
            monthId={pageData.activeMonth.id}
            note={pageData.activeMonth.note}
            returnTo={returnTo}
            isLocked={pageData.activeMonth.isLocked}
          />
        </section>
      </div>

      <ModalLauncher
        title="Ny utgift"
        trigger={
          <span className="floating-action-button">
            <Plus className="h-6 w-6" />
          </span>
        }
        triggerClassName="fixed bottom-6 right-4 z-30 sm:right-6 lg:bottom-8"
      >
        <ExpenseForm
          monthId={pageData.activeMonth.id}
          returnTo={returnTo}
          isLocked={pageData.activeMonth.isLocked}
          memberOptions={memberOptions}
        />
      </ModalLauncher>
    </>
  );
}
