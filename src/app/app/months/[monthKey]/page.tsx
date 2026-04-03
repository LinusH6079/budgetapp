import { PayerType } from "@prisma/client";
import { Plus } from "lucide-react";
import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expense-form";
import { ExpenseList } from "@/components/expense-list";
import { FlashMessage } from "@/components/flash-message";
import { IncomeCarryOverForm } from "@/components/income-carry-over-form";
import { ModalLauncher } from "@/components/modal-launcher";
import { MonthNotesCard } from "@/components/month-notes-card";
import { MonthTabs } from "@/components/month-tabs";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { filterExpenseItems, getMonthPageData, sortExpenseItems } from "@/server/services/budget-months";
import { mapMembersToSlots } from "@/server/services/households";

const EXPENSES_PER_PAGE = 6;

type MonthTabId = "summary" | "income" | "expenses" | "notes";

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
    expensePage?: string;
  }>;
};

function getActiveTab(tab?: string): MonthTabId {
  if (tab === "income" || tab === "expenses" || tab === "notes") {
    return tab;
  }

  return "summary";
}

function getPositivePage(page?: string) {
  return Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
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
  };

  const allFilteredExpenses = sortExpenseItems(filterExpenseItems(pageData.activeMonth.expenses, filters), "amount");
  const expensePageCount = Math.max(1, Math.ceil(allFilteredExpenses.length / EXPENSES_PER_PAGE));
  const currentExpensePage = Math.min(getPositivePage(resolvedSearchParams.expensePage), expensePageCount);
  const expenseStart = (currentExpensePage - 1) * EXPENSES_PER_PAGE;
  const pagedExpenses = allFilteredExpenses.slice(expenseStart, expenseStart + EXPENSES_PER_PAGE);

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
  ];
  const payerLabels: Record<PayerType, string> = {
    [PayerType.FIRST_PERSON]: memberOptions[0].label,
    [PayerType.SECOND_PERSON]: memberOptions[1].label,
    [PayerType.SHARED]: "Gemensamt",
  };

  const tabs = [
    { id: "summary" as const, label: "Sammanf." },
    { id: "income" as const, label: "Inkomst" },
    { id: "expenses" as const, label: "Utgifter" },
    { id: "notes" as const, label: "Anteckning" },
  ].map((tab) => {
    const tabQuery = new URLSearchParams(query);
    tabQuery.set("tab", tab.id);
    if (tab.id !== "expenses") {
      tabQuery.delete("expensePage");
    }

    return {
      ...tab,
      href: `/app/months/${monthKey}?${tabQuery.toString()}`,
    };
  });

  const previousExpenseQuery = new URLSearchParams(query);
  previousExpenseQuery.set("tab", "expenses");
  previousExpenseQuery.set("expensePage", String(Math.max(1, currentExpensePage - 1)));

  const nextExpenseQuery = new URLSearchParams(query);
  nextExpenseQuery.set("tab", "expenses");
  nextExpenseQuery.set("expensePage", String(Math.min(expensePageCount, currentExpensePage + 1)));

  const quickFilters = [
    { label: "Alla", status: "all" },
    { label: "Obetalda", status: "unpaid" },
    { label: "Betalda", status: "paid" },
  ].map((filter) => {
    const filterQuery = new URLSearchParams(query);
    filterQuery.set("tab", "expenses");
    filterQuery.set("status", filter.status);
    filterQuery.set("expensePage", "1");

    return {
      label: filter.label,
      href: `/app/months/${monthKey}?${filterQuery.toString()}`,
      active: filters.status === filter.status,
    };
  });

  const unexplained = pageData.previousSummary?.unexplainedDifferenceFromPreviousMonth ?? null;

  return (
    <div className="viewport-page">
      <FlashMessage notice={resolvedSearchParams.notice} error={resolvedSearchParams.error} />

      <MonthTabs activeTabId={activeTab} tabs={tabs} />

      {activeTab === "summary" ? (
        <section className="grid gap-4">
          <div className="rounded-[20px] bg-[var(--color-elevated)] px-4 py-4">
            <p className="eyebrow-label">Kvar just nu</p>
            <p className="mt-1 text-[2rem] font-semibold tracking-[-0.05em]">
              {formatCurrency(pageData.summary.remainingActual)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-tile">
              <p className="eyebrow-label">Tillgängligt</p>
              <p className="stat-value">{formatCurrency(pageData.summary.totalAvailable)}</p>
            </div>
            <div className="stat-tile">
              <p className="eyebrow-label">Obetalda</p>
              <p className="stat-value">{pageData.summary.unpaidCount} st</p>
            </div>
            <div className="stat-tile">
              <p className="eyebrow-label">Planerat kvar</p>
              <p className="stat-value">{formatCurrency(pageData.summary.remainingPlanned)}</p>
            </div>
            <div className="stat-tile">
              <p className="eyebrow-label">Oförklarat</p>
              <p className="stat-value">{unexplained === null ? "Ingen data" : formatCurrency(unexplained)}</p>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "income" ? (
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
            expenses={pagedExpenses}
            memberOptions={memberOptions}
            payerLabels={payerLabels}
            currentFilters={filters}
            categories={[...new Set(pageData.activeMonth.expenses.map((expense) => expense.category))].sort((a, b) =>
              a.localeCompare(b, "sv"),
            )}
            pageInfo={{
              currentPage: currentExpensePage,
              pageCount: expensePageCount,
              previousHref: `/app/months/${monthKey}?${previousExpenseQuery.toString()}`,
              nextHref: `/app/months/${monthKey}?${nextExpenseQuery.toString()}`,
            }}
            quickFilters={quickFilters}
          />

          <ModalLauncher
            title="Ny utgift"
            description="Snabb registrering för den här månaden."
            dialogClassName="sm:max-w-xl"
            trigger={
              <span className="floating-action-button">
                <Plus className="h-6 w-6" />
              </span>
            }
            triggerClassName="fixed bottom-24 right-4 z-30 sm:right-6 lg:bottom-8"
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
    </div>
  );
}
