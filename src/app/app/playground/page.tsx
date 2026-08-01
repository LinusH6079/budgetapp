import { Beaker, ChevronRight, Plus } from "lucide-react";

import { FlashMessage } from "@/components/flash-message";
import { FormStatusButton } from "@/components/form-status-button";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { ModalLauncher } from "@/components/modal-launcher";
import { PendingLink } from "@/components/pending-link";
import { formatMonthLabel, getCurrentMonthKey } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { createBudgetScenarioAction } from "@/server/actions/budget-scenario-actions";
import { getBudgetScenariosForUser } from "@/server/services/budget-scenarios";
import { getMonthsForUser } from "@/server/services/budget-months";

export default async function PlaygroundPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireUser();
  const [data, params] = await Promise.all([getBudgetScenariosForUser(user.id), searchParams]);
  if (!data) return <div className="viewport-page"><FlashMessage notice={params.notice} error={params.error} /><HouseholdSetupCard /></div>;
  const months = await getMonthsForUser(user.id);

  return <div className="viewport-page">
    <FlashMessage notice={params.notice} error={params.error} />
    <section className="app-panel px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="eyebrow-label">Playground</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Testbudgetar</h2><p className="mt-1 text-xs text-[var(--color-muted)]">Testa fritt utan att påverka riktiga månader.</p></div>
        <ModalLauncher title="Ny testbudget" description="Börja tomt eller skapa en fristående kopia av en månad." trigger={<span className="icon-action-button action-primary"><Plus className="h-4 w-4" /></span>}>
          <form action={createBudgetScenarioAction} className="grid gap-3">
            <label><span className="mb-1.5 block text-xs font-medium">Namn</span><input name="name" placeholder="Exempel: Lägre matbudget" required /></label>
            <label><span className="mb-1.5 block text-xs font-medium">Kopiera månad</span><select name="sourceMonthId" defaultValue=""><option value="">Börja tomt</option>{months.map((month) => <option key={month.id} value={month.id}>{formatMonthLabel(month.monthKey)}</option>)}</select></label>
            <label><span className="mb-1.5 block text-xs font-medium">Referensmånad</span><input name="referenceMonthKey" defaultValue={getCurrentMonthKey()} required /><span className="mt-1 block text-[10px] text-[var(--color-muted)]">För en kopia används källmånaden automatiskt.</span></label>
            <FormStatusButton className="action-primary justify-center" pendingLabel="Skapar...">Skapa testbudget</FormStatusButton>
          </form>
        </ModalLauncher>
      </div>

      <div className="mt-4 grid gap-2">
        {data.scenarios.length ? data.scenarios.map((scenario) => <PendingLink key={scenario.id} href={`/app/playground/${scenario.id}`} prefetch className="flex items-center gap-3 rounded-[17px] bg-[var(--color-elevated)] px-3.5 py-3 transition hover:bg-white/[0.06]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]"><Beaker className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{scenario.name}</span><span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">{formatMonthLabel(scenario.referenceMonthKey)} · {formatCurrency(scenario.summary.totalExpenses)} utgifter</span></span>
          <span className="shrink-0 text-right"><span className="block text-xs font-semibold">{formatCurrency(scenario.summary.remainingPlanned)}</span><span className="text-[10px] text-[var(--color-muted)]">kvar</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
        </PendingLink>) : <div className="rounded-[17px] border border-dashed border-[var(--color-line)] px-4 py-8 text-center"><Beaker className="mx-auto h-5 w-5 text-[var(--color-muted)]" /><p className="mt-2 text-sm font-medium">Inga testbudgetar ännu</p><p className="mt-1 text-xs text-[var(--color-muted)]">Tryck på plus för att testa ett scenario.</p></div>}
      </div>
    </section>
  </div>;
}
