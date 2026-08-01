import { FormStatusButton } from "@/components/form-status-button";
import { DeleteFinancingCaseButton } from "@/components/delete-financing-case-button";
import { formatCurrency } from "@/lib/money";
import { activateFinancingCaseAction } from "@/server/actions/loan-actions";

export type FinancingComparisonItem = {
    id: string;
    name: string;
    purchasePrice: number;
    downPayment: number;
    annualInterestBps: number;
    termMonths: number;
    amortizationType: "ANNUITY" | "STRAIGHT";
    comparison: {
      principal: number;
      initialCashPayment: number;
      firstMonthlyPayment: number;
      averageMonthlyPayment: number;
      lastMonthlyPayment: number;
      totalInterest: number;
      totalFees: number;
      totalLoanCost: number;
      extraCostComparedWithCash: number;
    };
};

type ComparisonCardProps = {
  item: FinancingComparisonItem;
  months: Array<{ id: string; monthKey: string }>;
};

export function FinancingComparisonCard({ item, months }: ComparisonCardProps) {
  return (
    <section className="app-panel px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow-label">Beslutsunderlag</p>
          <h2 className="mt-2 truncate text-lg font-semibold tracking-[-0.03em]">{item.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[var(--color-muted)]">
            {item.amortizationType === "ANNUITY" ? "Annuitet" : "Rak"}
          </span>
          <DeleteFinancingCaseButton caseId={item.id} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-[17px] border border-[var(--color-line)] bg-white/[0.02] px-3.5 py-3">
          <p className="eyebrow-label">Betala direkt</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(item.purchasePrice)}</p>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">Hela beloppet i en budgetmånad</p>
        </div>
        <div className="rounded-[17px] bg-[var(--color-elevated)] px-3.5 py-3">
          <p className="eyebrow-label">Lån per månad</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(item.comparison.averageMonthlyPayment)}</p>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">{item.termMonths} betalningar</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 rounded-[17px] border border-[var(--color-line)] px-3.5 py-3 text-xs">
        <div><p className="text-[var(--color-muted)]">Lånebelopp</p><p className="mt-0.5 font-semibold">{formatCurrency(item.comparison.principal)}</p></div>
        <div><p className="text-[var(--color-muted)]">Ränta</p><p className="mt-0.5 font-semibold">{(item.annualInterestBps / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2 })} %</p></div>
        <div><p className="text-[var(--color-muted)]">Total ränta</p><p className="mt-0.5 font-semibold">{formatCurrency(item.comparison.totalInterest)}</p></div>
        <div><p className="text-[var(--color-muted)]">Avgifter</p><p className="mt-0.5 font-semibold">{formatCurrency(item.comparison.totalFees)}</p></div>
        <div><p className="text-[var(--color-muted)]">Totalt med lån</p><p className="mt-0.5 font-semibold">{formatCurrency(item.comparison.totalLoanCost)}</p></div>
        <div><p className="text-[var(--color-muted)]">Merkostnad</p><p className="mt-0.5 font-semibold">{formatCurrency(item.comparison.extraCostComparedWithCash)}</p></div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-[var(--color-muted)]">
        Beloppen visas före eventuellt ränteavdrag. Räntan beräknas månadsvis.
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <form action={activateFinancingCaseAction} className="flex gap-2">
          <input type="hidden" name="caseId" value={item.id} />
          <input type="hidden" name="decision" value="CASH" />
          <select name="monthId" aria-label="Budgetmånad för direktköp" required>
            <option value="">Välj månad</option>
            {months.map((month) => <option key={month.id} value={month.id}>{month.monthKey}</option>)}
          </select>
          <FormStatusButton className="action-secondary shrink-0 justify-center" pendingLabel="">
            Betala direkt
          </FormStatusButton>
        </form>
        <form action={activateFinancingCaseAction}>
          <input type="hidden" name="caseId" value={item.id} />
          <input type="hidden" name="decision" value="LOAN" />
          <FormStatusButton className="action-primary w-full justify-center" pendingLabel="Aktiverar...">
            Välj lån
          </FormStatusButton>
        </form>
      </div>
    </section>
  );
}
