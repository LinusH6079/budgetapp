import { Wallet } from "lucide-react";

import { formatCurrency } from "@/lib/money";

type MonthSummaryCardsProps = {
  summary: {
    totalIncome: number;
    totalCarryOver: number;
    totalAvailable: number;
    totalPlannedExpenses: number;
    totalUnplannedExpenses: number;
    totalPaidExpenses: number;
    totalUnpaidExpenses: number;
    remainingPlanned: number;
    remainingActual: number;
    unpaidCount: number;
    overdueExpensesCount: number;
    unexplainedDifferenceFromPreviousMonth: number | null;
    perPerson: Array<{
      userId: string;
      name: string;
      income: number;
      carryOver: number;
      plannedExpenses: number;
      paidExpenses: number;
      remainingPlanned: number;
      remainingActual: number;
    }>;
  };
};

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "accent";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
      : tone === "accent"
        ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
        : "bg-[var(--color-elevated)] text-[var(--color-ink)]";

  return (
    <div className={`rounded-[20px] border border-[var(--color-line)] px-4 py-4 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

export function MonthSummaryCards({ summary }: MonthSummaryCardsProps) {
  return (
    <section className="space-y-4">
      <div className="app-panel sticky top-24 z-10 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--color-accent-soft)] p-2 text-[var(--color-ink)]">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-muted)]">Kvar nu</p>
            <p className="text-xl font-semibold tracking-[-0.03em]">{formatCurrency(summary.remainingActual)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Inkomst" value={formatCurrency(summary.totalIncome)} />
        <SummaryCard label="Saldo in" value={formatCurrency(summary.totalCarryOver)} />
        <SummaryCard label="Tillgängligt" value={formatCurrency(summary.totalAvailable)} tone="accent" />
        <SummaryCard label="Planerat" value={formatCurrency(summary.totalPlannedExpenses)} />
        <SummaryCard label="Oplanerat" value={formatCurrency(summary.totalUnplannedExpenses)} />
        <SummaryCard label="Betalt" value={formatCurrency(summary.totalPaidExpenses)} />
        <SummaryCard label="Obetalt" value={formatCurrency(summary.totalUnpaidExpenses)} />
        <SummaryCard
          label="Kvar"
          value={formatCurrency(summary.remainingActual)}
          tone={summary.remainingActual < 0 ? "danger" : "accent"}
        />
      </div>

      <div className="app-panel px-4 py-4 sm:px-5">
        <h2 className="section-title">Personer</h2>
        <div className="mt-4 grid gap-3">
          {summary.perPerson.map((person) => (
            <div key={person.userId} className="surface-card content-auto">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{person.name}</h3>
                <span className="pill-tag bg-[var(--color-accent-soft)] text-[var(--color-ink)]">
                  {formatCurrency(person.remainingActual)}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-3">
                <p>Inkomst {formatCurrency(person.income)}</p>
                <p>Saldo {formatCurrency(person.carryOver)}</p>
                <p>Kvar {formatCurrency(person.remainingPlanned)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
