import { formatCurrency } from "@/lib/money";

type CategoryBreakdownProps = {
  categories: Array<{
    category: string;
    amount: number;
  }>;
};

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const visibleCategories = categories.slice(0, 4);

  return (
    <section className="compact-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Kategorier</h2>
        {categories.length > visibleCategories.length ? (
          <span className="text-xs text-[var(--color-muted)]">+{categories.length - visibleCategories.length}</span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        {visibleCategories.length > 0 ? (
          visibleCategories.map((entry) => (
            <div key={entry.category} className="flex items-center justify-between rounded-[16px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-3 py-2.5">
              <span className="text-sm font-medium">{entry.category}</span>
              <span className="text-sm font-semibold">{formatCurrency(entry.amount)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Inga kategorier ännu.</p>
        )}
      </div>
    </section>
  );
}
