import { formatCurrency } from "@/lib/money";

type CategoryBreakdownProps = {
  categories: Array<{
    category: string;
    amount: number;
  }>;
};

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  return (
    <section className="app-panel px-5 py-5 sm:px-6">
      <h2 className="section-title">Kategoriöversikt</h2>
      <div className="mt-4 grid gap-3">
        {categories.length > 0 ? (
          categories.map((entry) => (
            <div key={entry.category} className="flex items-center justify-between rounded-[24px] bg-white px-4 py-4">
              <span className="font-medium">{entry.category}</span>
              <span className="font-semibold">{formatCurrency(entry.amount)}</span>
            </div>
          ))
        ) : (
          <p className="rounded-[24px] bg-white px-4 py-4 text-sm text-[var(--color-muted)]">
            Inga kategorier ännu för denna månad.
          </p>
        )}
      </div>
    </section>
  );
}
