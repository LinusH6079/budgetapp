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
    <div className={`rounded-[18px] border border-[var(--color-line)] px-3.5 py-3.5 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

export function MonthSummaryCards({ summary }: MonthSummaryCardsProps) {
  return (
    <section className="grid gap-4">
      <div className="compact-panel">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--color-accent-soft)] p-2 text-[var(--color-ink)]">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-muted)]">Kvar nu</p>
            <p className="text-2xl font-semibold tracking-[-0.04em]">{formatCurrency(summary.remainingActual)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Inkomst" value={formatCurrency(summary.totalIncome)} />
        <SummaryCard label="Saldo in" value={formatCurrency(summary.totalCarryOver)} />
        <SummaryCard label="Betalt" value={formatCurrency(summary.totalPaidExpenses)} />
        <SummaryCard
          label="Kvar"
          value={formatCurrency(summary.remainingActual)}
          tone={summary.remainingActual < 0 ? "danger" : "accent"}
        />
      </div>

      <div className="compact-panel">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">Planerat</p>
            <p className="mt-1 font-semibold">{formatCurrency(summary.totalPlannedExpenses)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">Obetalt</p>
            <p className="mt-1 font-semibold">{formatCurrency(summary.totalUnpaidExpenses)}</p>
          </div>
        </div>
      </div>

      <div className="compact-panel">
        <h2 className="section-title">Personer</h2>
        <div className="mt-3 grid gap-2.5">
          {summary.perPerson.map((person) => (
            <div key={person.userId} className="rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{person.name}</h3>
                <span className="pill-tag bg-[var(--color-accent-soft)] text-[var(--color-ink)]">
                  {formatCurrency(person.remainingActual)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-[var(--color-muted)]">
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
