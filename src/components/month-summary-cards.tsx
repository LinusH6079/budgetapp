import { TriangleAlert, Wallet } from "lucide-react";

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
        ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
        : "bg-white text-[var(--color-ink)]";

  return (
    <div className={`rounded-[28px] px-4 py-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

export function MonthSummaryCards({ summary }: MonthSummaryCardsProps) {
  return (
    <section className="space-y-4">
      <div className="app-panel sticky top-28 z-10 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--color-accent-soft)] p-2 text-[var(--color-accent)]">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Hushållets nuläge</p>
            <p className="text-xl font-semibold tracking-[-0.03em]">{formatCurrency(summary.remainingActual)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total inkomst" value={formatCurrency(summary.totalIncome)} />
        <SummaryCard label="Ingående saldo" value={formatCurrency(summary.totalCarryOver)} />
        <SummaryCard label="Tillgängligt" value={formatCurrency(summary.totalAvailable)} tone="accent" />
        <SummaryCard label="Planerade utgifter" value={formatCurrency(summary.totalPlannedExpenses)} />
        <SummaryCard label="Ej planerade utgifter" value={formatCurrency(summary.totalUnplannedExpenses)} />
        <SummaryCard label="Betalda utgifter" value={formatCurrency(summary.totalPaidExpenses)} />
        <SummaryCard label="Obetalda utgifter" value={formatCurrency(summary.totalUnpaidExpenses)} />
        <SummaryCard
          label="Kvar just nu"
          value={formatCurrency(summary.remainingActual)}
          tone={summary.remainingActual < 0 ? "danger" : "accent"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="app-panel px-5 py-5 sm:px-6">
          <h2 className="section-title">Per person</h2>
          <p className="muted mt-2">
            Gemensamma utgifter delas 50/50 i personliga summeringar för att ge en tydlig och konsekvent bild.
          </p>
          <div className="mt-4 grid gap-3">
            {summary.perPerson.map((person) => (
              <div key={person.userId} className="rounded-[24px] bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{person.name}</h3>
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
                    Faktiskt kvar {formatCurrency(person.remainingActual)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-3">
                  <p>Inkomst {formatCurrency(person.income)}</p>
                  <p>Ingående saldo {formatCurrency(person.carryOver)}</p>
                  <p>Planerat kvar {formatCurrency(person.remainingPlanned)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-[var(--color-warning)]" />
            <h2 className="section-title">Status</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-2xl bg-white px-4 py-3">
              Pengar kvar enligt plan: <strong>{formatCurrency(summary.remainingPlanned)}</strong>
            </p>
            <p className="rounded-2xl bg-white px-4 py-3">
              Obetalda poster: <strong>{summary.unpaidCount}</strong>
            </p>
            <p className="rounded-2xl bg-white px-4 py-3">
              Försenade obetalda: <strong>{summary.overdueExpensesCount}</strong>
            </p>
            <p className="rounded-2xl bg-white px-4 py-3">
              Oförklarad förbrukning:{" "}
              <strong>
                {summary.unexplainedDifferenceFromPreviousMonth === null
                  ? "Ingen nästa månad ännu"
                  : formatCurrency(summary.unexplainedDifferenceFromPreviousMonth)}
              </strong>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
