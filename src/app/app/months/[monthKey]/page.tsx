import { PayerType } from "@prisma/client";
import { ArrowLeft, Lock, LockOpen, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryBreakdown } from "@/components/category-breakdown";
import { DeleteMonthButton } from "@/components/delete-month-button";
import { ExpenseForm } from "@/components/expense-form";
import { ExpenseList } from "@/components/expense-list";
import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { IncomeCarryOverForm } from "@/components/income-carry-over-form";
import { LockMonthButton } from "@/components/lock-month-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { MonthNotesCard } from "@/components/month-notes-card";
import { MonthSummaryCards } from "@/components/month-summary-cards";
import { MonthTabs } from "@/components/month-tabs";
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

type MonthTabId = "summary" | "people" | "expenses" | "notes";

type MonthDetailPageProps = {
  params: Promise<{
    monthKey: string;
  }>;
  searchParams: Promise<{
    notice?: string;
    error?: string;
    tab?: string;
    status?: string;
    type?: string;
    category?: string;
    payer?: string;
    sort?: string;
  }>;
};

function getActiveTab(tab?: string): MonthTabId {
  if (tab === "people" || tab === "expenses" || tab === "notes") {
    return tab;
  }

  return "summary";
}

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

  const activeTab = getActiveTab(resolvedSearchParams.tab);
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
    category: resolvedSearchParams.category ?? "all",
    payer: resolvedSearchParams.payer ?? "all",
    sort: resolvedSearchParams.sort ?? "name",
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

  const dashboardSummary = {
    ...pageData.summary,
    unexplainedDifferenceFromPreviousMonth:
      pageData.previousSummary?.unexplainedDifferenceFromPreviousMonth ?? null,
  };

  const tabs = [
    {
      id: "summary" as const,
      label: "Översikt",
    },
    {
      id: "people" as const,
      label: "Personer",
    },
    {
      id: "expenses" as const,
      label: "Utgifter",
    },
    {
      id: "notes" as const,
      label: "Anteckning",
    },
  ].map((tab) => {
    const tabQuery = new URLSearchParams(query);
    tabQuery.set("tab", tab.id);

    return {
      ...tab,
      href: `/app/months/${monthKey}?${tabQuery.toString()}`,
    };
  });

  return (
    <>
      <FlashMessage notice={resolvedSearchParams.notice} error={resolvedSearchParams.error} />

      <Link href="/app/months" className="action-button action-secondary w-fit" prefetch>
        <ArrowLeft className="h-4 w-4" />
        Månader
      </Link>

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

      <MonthTabs activeTabId={activeTab} tabs={tabs} />

      {activeTab === "summary" ? (
        <div className="space-y-4">
          <MonthSummaryCards summary={dashboardSummary} />
          <CategoryBreakdown categories={pageData.summary.categories} />
        </div>
      ) : null}

      {activeTab === "people" ? (
        <IncomeCarryOverForm
          monthId={pageData.activeMonth.id}
          returnTo={returnTo}
          isLocked={pageData.activeMonth.isLocked}
          personSnapshots={pageData.activeMonth.personSnapshots}
        />
      ) : null}

      {activeTab === "expenses" ? (
        <>
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

          <ModalLauncher
            title="Ny utgift"
            dialogClassName="sm:max-w-2xl"
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
            />
          </ModalLauncher>
        </>
      ) : null}

      {activeTab === "notes" ? (
        <MonthNotesCard
          monthId={pageData.activeMonth.id}
          note={pageData.activeMonth.note}
          returnTo={returnTo}
          isLocked={pageData.activeMonth.isLocked}
        />
      ) : null}
    </>
  );
}
