import { Landmark, Plus } from "lucide-react";

import { ExistingLoanForm, FinancingCaseForm } from "@/components/loan-forms";
import { FinancingComparisonCard } from "@/components/financing-comparison-card";
import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { LoanCard } from "@/components/loan-card";
import { ModalLauncher } from "@/components/modal-launcher";
import { PendingLink } from "@/components/pending-link";
import { getCurrentMonthKey } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getLoanDashboardForUser } from "@/server/services/loans";
import { mapMembersToSlots } from "@/server/services/households";

type LoanPageProps = {
  searchParams: Promise<{
    tab?: string;
    caseId?: string;
    notice?: string;
    error?: string;
  }>;
};

function activeTab(tab?: string) {
  return tab === "active" || tab === "history" ? tab : "compare";
}

export default async function LoansPage({ searchParams }: LoanPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const dashboard = await getLoanDashboardForUser(user.id);
  if (!dashboard) return <div className="viewport-page"><HouseholdSetupCard /></div>;

  const tab = activeTab(params.tab);
  const members = mapMembersToSlots(dashboard.household);
  const ownerOptions = [
    ...members.map((member) => ({ label: member.name, value: member.slot })),
    ...(members.length === 2 ? [{ label: "Gemensamt", value: "SHARED" as const }] : []),
  ];
  const undecidedCases = dashboard.cases.filter((item) => item.decision === "UNDECIDED");
  const selectedCase = undecidedCases.find((item) => item.id === params.caseId) ?? undecidedCases[0] ?? null;
  const activeLoans = dashboard.loans.filter((loan) => loan.status === "ACTIVE");
  const historicalLoans = dashboard.loans.filter((loan) => loan.status !== "ACTIVE");
  const decisions = dashboard.cases.filter((item) => item.decision !== "UNDECIDED");
  const tabs = [
    { id: "compare", label: "Jämför" },
    { id: "active", label: "Aktiva" },
    { id: "history", label: "Historik" },
  ];

  return (
    <div className="viewport-page">
      <FlashMessage notice={params.notice} error={params.error} />

      <section className="app-panel px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow-label">Finansiering</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Lån eller direkt</h2></div>
          {tab === "compare" ? (
            <ModalLauncher title="Ny jämförelse" description="Jämför hela kontantkostnaden med en komplett låneplan." trigger={<span className="icon-action-button action-primary"><Plus className="h-4 w-4" /></span>} dialogClassName="sm:max-w-md">
              <FinancingCaseForm defaultStartMonth={getCurrentMonthKey()} ownerOptions={ownerOptions} />
            </ModalLauncher>
          ) : tab === "active" ? (
            <ModalLauncher title="Befintligt lån" description="Starta från dagens restskuld och återstående löptid." trigger={<span className="icon-action-button action-primary"><Plus className="h-4 w-4" /></span>} dialogClassName="sm:max-w-md">
              <ExistingLoanForm defaultStartMonth={getCurrentMonthKey()} ownerOptions={ownerOptions} />
            </ModalLauncher>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-3 rounded-[15px] bg-white/[0.025] p-1">
          {tabs.map((item) => (
            <PendingLink key={item.id} href={`/app/loans?tab=${item.id}`} className={`rounded-xl px-2 py-2 text-center text-xs font-medium transition ${tab === item.id ? "bg-[var(--color-elevated)] text-[var(--color-ink)]" : "text-[var(--color-muted)]"}`}>{item.label}</PendingLink>
          ))}
        </div>
      </section>

      {tab === "compare" ? (
        <>
          {selectedCase ? <FinancingComparisonCard item={selectedCase} months={dashboard.months} /> : (
            <section className="rounded-[20px] border border-dashed border-[var(--color-line)] px-5 py-8 text-center"><Landmark className="mx-auto h-5 w-5 text-[var(--color-muted)]" /><p className="mt-3 text-sm font-semibold">Ingen jämförelse ännu</p><p className="mt-1 text-[11px] text-[var(--color-muted)]">Tryck på plus för att jämföra ett köp.</p></section>
          )}
          {undecidedCases.length > 1 ? (
            <section className="app-panel px-4 py-4"><p className="eyebrow-label">Sparade jämförelser</p><div className="mt-3 grid gap-1.5">{undecidedCases.map((item) => <PendingLink key={item.id} href={`/app/loans?tab=compare&caseId=${item.id}`} className={`flex items-center justify-between rounded-[14px] px-3 py-2.5 text-sm ${item.id === selectedCase?.id ? "bg-[var(--color-elevated)]" : "bg-white/[0.02]"}`}><span className="truncate font-medium">{item.name}</span><span className="shrink-0 text-xs text-[var(--color-muted)]">{formatCurrency(item.purchasePrice)}</span></PendingLink>)}</div></section>
          ) : null}
        </>
      ) : null}

      {tab === "active" ? (
        activeLoans.length > 0 ? <section className="grid gap-2.5 lg:grid-cols-2">{activeLoans.map((loan) => <LoanCard key={loan.id} loan={loan} months={dashboard.months} />)}</section> : <section className="rounded-[20px] border border-dashed border-[var(--color-line)] px-5 py-8 text-center"><p className="text-sm font-semibold">Inga aktiva lån</p><p className="mt-1 text-[11px] text-[var(--color-muted)]">Aktivera en jämförelse eller registrera ett befintligt lån.</p></section>
      ) : null}

      {tab === "history" ? (
        <section className="app-panel px-4 py-4 sm:px-5">
          <p className="eyebrow-label">Beslut och avslutade lån</p>
          <div className="mt-3 grid gap-1.5">
            {[...decisions.map((item) => ({ id: item.id, name: item.name, label: item.decision === "CASH" ? "Betalat direkt" : "Lån aktiverat", amount: item.purchasePrice })), ...historicalLoans.map((loan) => ({ id: loan.id, name: loan.name, label: loan.status === "PAID_OFF" ? "Återbetalt" : "Avslutat", amount: loan.initialPrincipal }))].map((item) => <div key={`${item.label}-${item.id}`} className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--color-elevated)] px-3.5 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{item.label}</p></div><p className="shrink-0 text-sm font-semibold">{formatCurrency(item.amount)}</p></div>)}
            {decisions.length === 0 && historicalLoans.length === 0 ? <p className="py-5 text-center text-xs text-[var(--color-muted)]">Ingen historik ännu.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
