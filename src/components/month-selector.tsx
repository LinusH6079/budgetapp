import Link from "next/link";

import { formatMonthLabel } from "@/lib/date";

type MonthSelectorProps = {
  months: Array<{
    id: string;
    monthKey: string;
    isLocked: boolean;
  }>;
  activeMonthKey?: string;
  getHref?: (monthKey: string) => string;
};

export function MonthSelector({ months, activeMonthKey, getHref }: MonthSelectorProps) {
  if (months.length === 0) {
    return <div className="surface-card text-sm text-[var(--color-muted)]">Inga månader skapade ännu.</div>;
  }

  return (
    <div className="grid gap-2">
      {months.map((month) => (
        <Link
          key={month.id}
          href={getHref ? getHref(month.monthKey) : `/app/months/${month.monthKey}`}
          className={`rounded-[18px] border px-4 py-3 ${
            month.monthKey === activeMonthKey
              ? "border-[var(--color-accent-strong)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
              : "border-[var(--color-line)] bg-[color:var(--color-elevated)] text-[var(--color-ink)]"
          }`}
        >
          <p className="text-sm font-semibold capitalize">{formatMonthLabel(month.monthKey)}</p>
          <p className="mt-1 text-xs opacity-80">{month.isLocked ? "Låst" : "Öppen"}</p>
        </Link>
      ))}
    </div>
  );
}
