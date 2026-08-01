"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  FinancingComparisonCard,
  type FinancingComparisonItem,
} from "@/components/financing-comparison-card";
import { formatCurrency } from "@/lib/money";

type SavedFinancingCaseSelectorProps = {
  cases: FinancingComparisonItem[];
  initialCaseId: string;
  months: Array<{ id: string; monthKey: string }>;
};

export function SavedFinancingCaseSelector({
  cases,
  initialCaseId,
  months,
}: SavedFinancingCaseSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedCaseId(initialCaseId);
  }, [initialCaseId]);

  const selectedCase = cases.find((item) => item.id === selectedCaseId) ?? cases[0];

  function selectCase(caseId: string) {
    if (caseId === selectedCaseId) return;

    setSelectedCaseId(caseId);
    window.dispatchEvent(new CustomEvent("app:navigation-start"));

    const query = new URLSearchParams(searchParams.toString());
    query.set("tab", "compare");
    query.set("caseId", caseId);
    query.delete("notice");
    query.delete("error");

    startTransition(() => {
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    });
  }

  return (
    <>
      <FinancingComparisonCard item={selectedCase} months={months} />

      {cases.length > 1 ? (
        <section className="app-panel px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow-label">Sparade jämförelser</p>
            {isPending ? <span className="spinner" aria-label="Byter jämförelse" /> : null}
          </div>
          <div className="mt-3 grid gap-1.5">
            {cases.map((item) => {
              const isSelected = item.id === selectedCase.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectCase(item.id)}
                  aria-pressed={isSelected}
                  className={`flex min-h-11 touch-manipulation items-center justify-between rounded-[14px] px-3 py-2.5 text-left text-sm transition-colors active:bg-white/[0.08] ${
                    isSelected
                      ? "bg-[var(--color-elevated)] text-[var(--color-ink)]"
                      : "bg-white/[0.02] text-[var(--color-muted)]"
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">{item.name}</span>
                  <span className="ml-3 shrink-0 text-xs text-[var(--color-muted)]">
                    {formatCurrency(item.purchasePrice)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
