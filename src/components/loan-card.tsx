import { CalendarClock, Gauge, Plus, TrendingDown } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { formatCurrency } from "@/lib/money";
import {
  addLoanExtraPaymentAction,
  adjustLoanInstallmentAction,
  changeLoanRateAction,
} from "@/server/actions/loan-actions";

type LoanCardProps = {
  loan: {
    id: string;
    name: string;
    initialPrincipal: number;
    remainingPrincipal: number;
    termMonths: number;
    amortizationType: "ANNUITY" | "STRAIGHT";
    startMonth: string;
    ratePeriods: Array<{ startMonth: string; annualInterestBps: number }>;
    installments: Array<{
      id: string;
      monthKey: string;
      principalAmount: number;
      interestAmount: number;
      feeAmount: number;
      totalAmount: number;
      expense: { isPaid: boolean } | null;
    }>;
    nextInstallment: {
      id: string;
      monthKey: string;
      totalAmount: number;
    } | null;
  };
  months: Array<{ id: string; monthKey: string }>;
};

export function LoanCard({ loan, months }: LoanCardProps) {
  const paidFraction = loan.initialPrincipal > 0
    ? Math.min(1, 1 - loan.remainingPrincipal / loan.initialPrincipal)
    : 1;
  const currentRate = loan.ratePeriods.at(-1)?.annualInterestBps ?? 0;
  const futureMonths = loan.installments.filter((row) => !row.expense?.isPaid);

  return (
    <article className="rounded-[19px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3.5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{loan.name}</p>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            {loan.amortizationType === "ANNUITY" ? "Annuitet" : "Rak amortering"} · {(currentRate / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2 })} %
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-medium text-[#86efac]">Aktivt</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div><p className="eyebrow-label">Restskuld</p><p className="mt-1 text-xl font-semibold tracking-[-0.04em]">{formatCurrency(loan.remainingPrincipal)}</p></div>
        {loan.nextInstallment ? <div className="text-right"><p className="text-[10px] text-[var(--color-muted)]">Nästa · {loan.nextInstallment.monthKey}</p><p className="mt-1 text-sm font-semibold">{formatCurrency(loan.nextInstallment.totalAmount)}</p></div> : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-[var(--color-accent-strong)]" style={{ width: `${paidFraction * 100}%` }} /></div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ModalLauncher
          title="Ändra ränta"
          description="Framtida obetalda månader räknas om från vald månad."
          trigger={<span className="action-button action-secondary w-full justify-center"><Gauge className="h-4 w-4" /> Ränta</span>}
        >
          <form action={changeLoanRateAction} className="grid gap-3">
            <input type="hidden" name="loanId" value={loan.id} />
            <label><span className="mb-1.5 block text-xs font-medium">Från budgetmånad</span><select name="startMonth" required>{futureMonths.map((row) => <option key={row.id} value={row.monthKey}>{row.monthKey}</option>)}</select></label>
            <label><span className="mb-1.5 block text-xs font-medium">Ny ränta</span><input name="annualInterestRate" inputMode="decimal" defaultValue={(currentRate / 100).toFixed(2)} required /></label>
            <FormStatusButton className="action-primary w-full justify-center" pendingLabel="Räknar om...">Spara ny ränta</FormStatusButton>
          </form>
        </ModalLauncher>
        <ModalLauncher
          title="Extra amortering"
          description="När utgiften betalas kortas lånets återstående löptid."
          trigger={<span className="action-button action-secondary w-full justify-center"><TrendingDown className="h-4 w-4" /> Extra</span>}
        >
          <form action={addLoanExtraPaymentAction} className="grid gap-3">
            <input type="hidden" name="loanId" value={loan.id} />
            <label><span className="mb-1.5 block text-xs font-medium">Budgetmånad</span><select name="monthId" required>{months.map((month) => <option key={month.id} value={month.id}>{month.monthKey}</option>)}</select></label>
            <label><span className="mb-1.5 block text-xs font-medium">Belopp</span><input name="amount" inputMode="decimal" placeholder="5000" required /></label>
            <FormStatusButton className="action-primary w-full justify-center" pendingLabel="Lägger till..."><Plus className="h-4 w-4" /> Lägg till i budgeten</FormStatusButton>
          </form>
        </ModalLauncher>
        {loan.nextInstallment ? (
          <ModalLauncher
            title="Justera betalning"
            description="Flytta nästa betalning eller ändra beloppet. Senare månader räknas om."
            trigger={<span className="action-button action-secondary w-full justify-center"><CalendarClock className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Justera</span></span>}
          >
            <form action={adjustLoanInstallmentAction} className="grid gap-3">
              <input type="hidden" name="loanId" value={loan.id} />
              <input type="hidden" name="installmentId" value={loan.nextInstallment.id} />
              <label><span className="mb-1.5 block text-xs font-medium">Budgetmånad</span><select name="monthId" defaultValue={months.find((month) => month.monthKey === loan.nextInstallment?.monthKey)?.id} required>{months.map((month) => <option key={month.id} value={month.id}>{month.monthKey}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-medium">Totalt belopp</span><input name="totalAmount" inputMode="decimal" defaultValue={(loan.nextInstallment.totalAmount / 100).toFixed(2)} required /></label>
              <FormStatusButton className="action-primary w-full justify-center" pendingLabel="Räknar om...">Spara justering</FormStatusButton>
            </form>
          </ModalLauncher>
        ) : null}
      </div>

      <details className="mt-3 border-t border-[var(--color-line)] pt-3">
        <summary className="cursor-pointer text-xs font-medium text-[var(--color-muted)]">Visa betalplan · {loan.installments.length} månader</summary>
        <div className="mt-2 max-h-52 space-y-1 overflow-y-auto overscroll-contain no-scrollbar">
          {loan.installments.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.025] px-3 py-2 text-xs">
              <div><p className="font-medium">{row.monthKey}</p><p className="mt-0.5 text-[9px] text-[var(--color-muted)]">Amort. {formatCurrency(row.principalAmount)} · ränta {formatCurrency(row.interestAmount)}</p></div>
              <div className="text-right"><p className="font-semibold">{formatCurrency(row.totalAmount)}</p><p className={`mt-0.5 text-[9px] ${row.expense?.isPaid ? "text-[#86efac]" : "text-[var(--color-muted)]"}`}>{row.expense?.isPaid ? "Betald" : "Planerad"}</p></div>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}
