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
import { getAnnualBudgetForUser } from "@/server/services/annual-budget";
import { filterExpenseItems, getMonthPageData, sortExpenseItems } from "@/server/services/budget-months";
import { mapMembersToSlots } from "@/server/services/households";

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
  }>;
};

function getActiveTab(tab?: string): MonthTabId {
  if (tab === "income" || tab === "expenses" || tab === "notes") {
    return tab;
  }

  return "summary";
}

function SummaryPersonBreakdown({
  items,
}: {
  items: Array<{
    name: string;
    value: string;
  }>;
}) {
  return (
    <div className="mt-2 grid gap-1">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-muted)]">
          <span className="truncate">{item.name}</span>
          <span className="shrink-0 font-medium text-[var(--color-ink)]/82">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function MonthDetailPage({
  params,
  searchParams,
}: MonthDetailPageProps) {
  const user = await requireUser();
  const { monthKey } = await params;
  const resolvedSearchParams = await searchParams;
  // Annual saving rows are synchronized before the month snapshot is read.
  const annualBudget = await getAnnualBudgetForUser(user.id);
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

  query.delete("expensePage");
  query.delete("payer");

  const returnTo = `/app/months/${monthKey}${query.toString() ? `?${query.toString()}` : ""}`;
  const filters = {
    status: resolvedSearchParams.status ?? "all",
    type: resolvedSearchParams.type ?? "all",
    category: resolvedSearchParams.category ?? "all",
  };

  const filteredExpenses = sortExpenseItems(filterExpenseItems(pageData.activeMonth.expenses, filters), "amount");

  const orderedMembers = mapMembersToSlots(pageData.household);
  const memberOptions = orderedMembers.map((member) => ({
    label: member.name,
    value:
      member.slot === "FIRST_PERSON"
        ? PayerType.FIRST_PERSON
        : PayerType.SECOND_PERSON,
  }));
  const currentUserPayerType =
    orderedMembers.find((member) => member.userId === user.id)?.slot ===
    "SECOND_PERSON"
      ? PayerType.SECOND_PERSON
      : PayerType.FIRST_PERSON;
  const annualBudgetOptions = (annualBudget?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
  }));
  const payerLabels: Record<PayerType, string> = {
    [PayerType.FIRST_PERSON]: memberOptions[0]?.label ?? "Person 1",
    [PayerType.SECOND_PERSON]: memberOptions[1]?.label ?? "Person 2",
    [PayerType.SHARED]: "Båda",
  };

  const tabs = [
    { id: "summary" as const, label: "Sammanf." },
    { id: "income" as const, label: "Inkomst" },
    { id: "expenses" as const, label: "Utgifter" },
    { id: "notes" as const, label: "Anteckning" },
  ].map((tab) => {
    const tabQuery = new URLSearchParams(query);
    tabQuery.set("tab", tab.id);

    return {
      ...tab,
      href: `/app/months/${monthKey}?${tabQuery.toString()}`,
    };
  });

  const quickFilters = [
    { label: "Alla", status: "all" },
    { label: "Obetalda", status: "unpaid" },
    { label: "Betalda", status: "paid" },
  ].map((filter) => {
    const filterQuery = new URLSearchParams(query);
    filterQuery.set("tab", "expenses");
    filterQuery.set("status", filter.status);

    return {
      label: filter.label,
      href: `/app/months/${monthKey}?${filterQuery.toString()}`,
      active: filters.status === filter.status,
    };
  });

  const unexplained = pageData.previousSummary?.unexplainedDifferenceFromPreviousMonth ?? null;
  const perPersonAvailable = pageData.summary.perPerson.map((person) => ({
    name: person.name,
    value: formatCurrency(person.income + person.carryOver),
  }));
  const perPersonRemainingActual = pageData.summary.perPerson.map((person) => ({
    name: person.name,
    value: formatCurrency(person.remainingActual),
  }));
  const perPersonExpenses = pageData.summary.perPerson.map((person) => ({
    name: person.name,
    value: formatCurrency(person.totalExpenses),
  }));
  const perPersonRemainingPlanned = pageData.summary.perPerson.map((person) => ({
    name: person.name,
    value: formatCurrency(person.remainingPlanned),
  }));
  const perPersonUnexplained = pageData.summary.perPerson
    .filter(
      (person) =>
        person.unexplainedDifferenceFromPreviousMonth !== null &&
        person.unexplainedDifferenceFromPreviousMonth !== undefined,
    )
    .map((person) => ({
      name: person.name,
      value: formatCurrency(person.unexplainedDifferenceFromPreviousMonth ?? 0),
    }));

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
            <SummaryPersonBreakdown items={perPersonRemainingActual} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-tile">
              <p className="eyebrow-label">Tillgängligt</p>
              <p className="stat-value">{formatCurrency(pageData.summary.totalAvailable)}</p>
              <SummaryPersonBreakdown items={perPersonAvailable} />
            </div>
            <div className="stat-tile">
              <p className="eyebrow-label">Totala utgifter</p>
              <p className="stat-value">{formatCurrency(pageData.summary.totalExpenses)}</p>
              <SummaryPersonBreakdown items={perPersonExpenses} />
            </div>
            <div className="stat-tile">
              <p className="eyebrow-label">Obetalda</p>
              <p className="stat-value">{pageData.summary.unpaidCount} st</p>
            </div>
            <div className="stat-tile">
              <p className="eyebrow-label">Planerat kvar</p>
              <p className="stat-value">{formatCurrency(pageData.summary.remainingPlanned)}</p>
              <SummaryPersonBreakdown items={perPersonRemainingPlanned} />
            </div>
            <div className="stat-tile">
              <p className="eyebrow-label">
                Utgifter som ej blev loggade föregående månad
              </p>
              <p className="stat-value">{unexplained === null ? "Ingen data" : formatCurrency(unexplained)}</p>
              {perPersonUnexplained.length > 0 ? <SummaryPersonBreakdown items={perPersonUnexplained} /> : null}
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
            expenses={filteredExpenses}
            memberOptions={memberOptions}
            currentUserPayerType={currentUserPayerType}
            annualBudgetOptions={annualBudgetOptions}
            payerLabels={payerLabels}
            currentFilters={filters}
            categories={[...new Set(pageData.activeMonth.expenses.map((expense) => expense.category))].sort((a, b) =>
              a.localeCompare(b, "sv"),
            )}
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
            triggerClassName="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-30 sm:right-6 lg:bottom-8"
          >
            <ExpenseForm
              monthId={pageData.activeMonth.id}
              returnTo={returnTo}
              isLocked={pageData.activeMonth.isLocked}
              memberOptions={memberOptions}
              currentUserPayerType={currentUserPayerType}
              annualBudgetOptions={annualBudgetOptions}
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
