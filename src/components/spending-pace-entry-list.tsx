"use client";

import { ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatCurrency } from "@/lib/money";
import { deleteSpendingPaceEntryAction } from "@/server/actions/spending-pace-actions";

type SpendingPaceEntryListProps = {
  entries: Array<{
    id: string;
    amount: number;
    weekStartKey: string;
    createdAt: string;
  }>;
};

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWeekStart(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function SpendingPaceEntryList({ entries }: SpendingPaceEntryListProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const availableEntries = entries
    .filter((entry) => !deletedIds.includes(entry.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const visibleEntries = isExpanded ? availableEntries : availableEntries.slice(0, 1);

  if (availableEntries.length === 0) {
    return null;
  }

  const deleteEntry = (entryId: string) => {
    if (pendingId) {
      return;
    }

    setPendingId(entryId);
    setErrorMessage(null);
    setDeletedIds((current) => [...current, entryId]);

    startTransition(async () => {
      const result = await deleteSpendingPaceEntryAction({ entryId });

      if (!result.ok) {
        setDeletedIds((current) => current.filter((id) => id !== entryId));
        setErrorMessage(result.message);
        setPendingId(null);
        return;
      }

      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-black/10">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="touch-feedback flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
        aria-expanded={isExpanded}
      >
        <span className="text-[12px] font-semibold">Registrerade utgifter</span>
        <span className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
          {availableEntries.length} st
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <div className="border-t border-[var(--color-line)]">
        {visibleEntries.map((entry) => (
          <div
            key={entry.id}
            className={`flex min-h-11 items-center gap-3 border-b border-[var(--color-line)] px-3 py-2 last:border-b-0 ${
              pendingId === entry.id ? "opacity-55" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium">{formatCurrency(entry.amount)}</p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">
                {formatEntryDate(entry.createdAt)} · vecka från {formatWeekStart(entry.weekStartKey)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => deleteEntry(entry.id)}
              disabled={pendingId !== null}
              className="touch-feedback inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] disabled:opacity-45"
              aria-label={`Ta bort ${formatCurrency(entry.amount)}`}
              title="Ta bort utgift"
            >
              {pendingId === entry.id ? (
                <span className="spinner !h-3.5 !w-3.5" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ))}
      </div>

      {!isExpanded && availableEntries.length > 1 ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="touch-feedback w-full border-t border-[var(--color-line)] px-3 py-2 text-center text-[10px] font-medium text-[var(--color-muted)]"
        >
          Visa alla
        </button>
      ) : null}

      {errorMessage ? (
        <p className="border-t border-[var(--color-line)] px-3 py-2 text-[11px] font-medium text-[var(--color-danger)]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
