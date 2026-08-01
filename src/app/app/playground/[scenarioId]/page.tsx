import { Plus, RefreshCw } from "lucide-react";
import { notFound } from "next/navigation";

import { BudgetScenarioDeleteButton } from "@/components/budget-scenario-delete-button";
import { ScenarioExpenseActions, ScenarioExpenseForm, ScenarioIncomeForms, ScenarioManagement, ScenarioNotesForm } from "@/components/budget-scenario-forms";
import { FlashMessage } from "@/components/flash-message";
import { ModalLauncher } from "@/components/modal-launcher";
import { MonthTabs } from "@/components/month-tabs";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getBudgetScenarioForUser } from "@/server/services/budget-scenarios";

type Tab = "summary" | "income" | "expenses" | "notes";

export default async function BudgetScenarioPage({ params, searchParams }: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<{ tab?: string; notice?: string; error?: string }>;
}) {
  const user = await requireUser();
  const [{ scenarioId }, query] = await Promise.all([params, searchParams]);
  const data = await getBudgetScenarioForUser(user.id, scenarioId).catch(() => null);
  if (!data) notFound();
  const activeTab: Tab = query.tab === "income" || query.tab === "expenses" || query.tab === "notes" ? query.tab : "summary";
  const basePath = `/app/playground/${scenarioId}`;
  const returnTo = `${basePath}?tab=${activeTab}`;
  const tabs = [
    { id: "summary", label: "Sammanf." }, { id: "income", label: "Inkomst" },
    { id: "expenses", label: "Utgifter" }, { id: "notes", label: "Anteckning" },
  ].map((tab) => ({ ...tab, href: `${basePath}?tab=${tab.id}` }));
  const memberOptions = data.members.map((member) => ({ userId: member.userId, name: member.name, slot: member.slot }));
  const payerName = (payerType: string) => payerType === "SHARED" ? "Båda" : data.members.find((member) => member.slot === payerType)?.name ?? "Person";

  return <div className="viewport-page">
    <FlashMessage notice={query.notice} error={query.error} />
    <section className="flex items-center justify-between gap-3 px-1">
      <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-lg font-semibold tracking-[-0.03em]">{data.scenario.name}</h2><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">TEST</span></div><p className="mt-0.5 text-[11px] capitalize text-[var(--color-muted)]">{formatMonthLabel(data.scenario.referenceMonthKey)}{data.scenario.sourceMonthKey ? " · kopierad" : " · tom mall"}</p></div>
      <div className="flex shrink-0 items-center gap-1.5"><ScenarioManagement scenarioId={scenarioId} name={data.scenario.name} referenceMonthKey={data.scenario.referenceMonthKey} returnTo={returnTo} /><BudgetScenarioDeleteButton scenarioId={scenarioId} /></div>
    </section>
    <MonthTabs activeTabId={activeTab} tabs={tabs} />

    {activeTab === "summary" ? <section className="grid gap-3">
      <div className="rounded-[20px] bg-[var(--color-elevated)] px-4 py-4"><p className="eyebrow-label">Kvar efter utgifter</p><p className="mt-1 text-[2rem] font-semibold tracking-[-0.05em]">{formatCurrency(data.summary.remainingPlanned)}</p><div className="mt-2 grid gap-1">{data.summary.perPerson.map((person) => <div key={person.userId} className="flex justify-between text-[11px] text-[var(--color-muted)]"><span>{person.name}</span><span className="font-medium text-[var(--color-ink)]">{formatCurrency(person.remainingPlanned)}</span></div>)}</div></div>
      <div className="grid grid-cols-2 gap-2.5"><div className="stat-tile"><p className="eyebrow-label">Tillgängligt</p><p className="stat-value">{formatCurrency(data.summary.totalAvailable)}</p></div><div className="stat-tile"><p className="eyebrow-label">Utgifter</p><p className="stat-value">{formatCurrency(data.summary.totalExpenses)}</p></div><div className="stat-tile"><p className="eyebrow-label">Inkomst</p><p className="stat-value">{formatCurrency(data.summary.totalIncome)}</p></div><div className="stat-tile"><p className="eyebrow-label">Saldo in</p><p className="stat-value">{formatCurrency(data.summary.totalCarryOver)}</p></div></div>
      {data.summary.categories.length ? <div className="app-panel px-4 py-4"><p className="eyebrow-label">Kategorier</p><div className="mt-3 grid gap-2">{data.summary.categories.map((item) => <div key={item.category} className="flex justify-between text-sm"><span className="text-[var(--color-muted)]">{item.category}</span><span className="font-medium">{formatCurrency(item.amount)}</span></div>)}</div></div> : null}
    </section> : null}

    {activeTab === "income" ? <ScenarioIncomeForms scenarioId={scenarioId} returnTo={returnTo} snapshots={data.scenario.personSnapshots} /> : null}

    {activeTab === "expenses" ? <>
      <section className="app-panel overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3"><div><p className="eyebrow-label">Utgifter</p><p className="mt-1 text-xs text-[var(--color-muted)]">{data.scenario.expenses.length} poster · {formatCurrency(data.summary.totalExpenses)}</p></div></div>
        <div className="max-h-[calc(100dvh-17rem)] overflow-y-auto overscroll-contain px-2 py-1.5">
          {data.scenario.expenses.length ? data.scenario.expenses.map((expense) => <article key={expense.id} className="flex min-w-0 items-center gap-2 border-b border-[var(--color-line)] px-2 py-2 last:border-0"><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-[13px] font-medium">{expense.name}</p>{expense.isSystemGenerated ? <span title="Återskapas från aktuell automatik vid publicering" aria-label="Automatisk live-post"><RefreshCw className="h-3 w-3 shrink-0 text-[var(--color-muted)]" /></span> : null}</div><p className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">{expense.category} · {payerName(expense.payerType)} · {expense.expenseType === "RECURRING" ? "Återkommande" : "Engångs"}{expense.isSystemGenerated ? " · Automatisk live" : ""}</p></div><p className="shrink-0 text-sm font-semibold">{formatCurrency(expense.amount)}</p><ScenarioExpenseActions scenarioId={scenarioId} returnTo={returnTo} members={memberOptions} expense={expense} /></article>) : <p className="px-3 py-8 text-center text-sm text-[var(--color-muted)]">Inga utgifter i scenariot.</p>}
        </div>
      </section>
      <ModalLauncher title="Ny testutgift" trigger={<span className="floating-action-button"><Plus className="h-6 w-6" /></span>} triggerClassName="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-30 sm:right-6 lg:bottom-8"><ScenarioExpenseForm scenarioId={scenarioId} returnTo={returnTo} members={memberOptions} /></ModalLauncher>
    </> : null}

    {activeTab === "notes" ? <ScenarioNotesForm scenarioId={scenarioId} note={data.scenario.note} returnTo={returnTo} /> : null}
  </div>;
}
