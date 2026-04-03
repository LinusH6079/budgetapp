import { PayerType } from "@prisma/client";
import { ArrowLeft, Lock, LockOpen, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expense-form";
import { ExpenseList } from "@/components/expense-list";
import { FlashMessage } from "@/components/flash-message";
import { IncomeCarryOverForm } from "@/components/income-carry-over-form";
import { ModalLauncher } from "@/components/modal-launcher";
import { MonthNotesCard } from "@/components/month-notes-card";
import { MonthTabs } from "@/components/month-tabs";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
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
    sort?: string;
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
    sort: resolvedSearchParams.sort ?? "name",
  };

  const allFilteredExpenses = sortExpenseItems(
    filterExpenseItems(pageData.activeMonth.expenses, filters),
    filters.sort,
  );
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

      <Link href="/app/months" className="action-button action-secondary w-fit" prefetch>
        <ArrowLeft className="h-4 w-4" />
        Månader
      </Link>

      <section className="app-panel px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Månad</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] capitalize">
                {formatMonthLabel(monthKey)}
              </h2>
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                  pageData.activeMonth.isLocked
                    ? "border-[var(--color-line)] bg-[var(--color-elevated)] text-[var(--color-muted)]"
                    : "border-[var(--color-line)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                }`}
              >
                {pageData.activeMonth.isLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              </span>
            </div>
            <p className="muted mt-2">{formatDateTime(pageData.activeMonth.updatedAt)}</p>
          </div>
        </div>
      </section>

      <MonthTabs activeTabId={activeTab} tabs={tabs} />

      {activeTab === "summary" ? (
        <section className="grid gap-4">
          <div className="rounded-[22px] bg-[var(--color-elevated)] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">Kvar just nu</p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.05em]">
              {formatCurrency(pageData.summary.remainingActual)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-[var(--color-elevated)] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">Tillgängligt</p>
              <p className="mt-1.5 text-base font-semibold">{formatCurrency(pageData.summary.totalAvailable)}</p>
            </div>
            <div className="rounded-[18px] bg-[var(--color-elevated)] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">Obetalda</p>
              <p className="mt-1.5 text-base font-semibold">{pageData.summary.unpaidCount} st</p>
            </div>
            <div className="rounded-[18px] bg-[var(--color-elevated)] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">Planerat kvar</p>
              <p className="mt-1.5 text-base font-semibold">{formatCurrency(pageData.summary.remainingPlanned)}</p>
            </div>
            <div className="rounded-[18px] bg-[var(--color-elevated)] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">Oförklarat</p>
              <p className="mt-1.5 text-base font-semibold">
                {unexplained === null ? "Ingen data" : formatCurrency(unexplained)}
              </p>
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
