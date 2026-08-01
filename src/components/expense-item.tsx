"use client";

import { PayerType } from "@prisma/client";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { expensePartAmount } from "@/lib/budget-calculations";
import { formatCurrency } from "@/lib/money";
import { deleteExpenseAction, toggleExpensePaidOptimisticAction } from "@/server/actions/expense-actions";

import { ExpenseForm } from "./expense-form";

type ExpenseItemProps = {
  expense: {
    id: string;
    name: string;
    amount: number;
    category: string;
    expenseType: "RECURRING" | "ONE_TIME";
    origin: "STANDARD" | "ANNUAL_SAVING";
    payerType: PayerType;
    dueDate: Date | null;
    isPaid: boolean;
    paidAt: Date | null;
    firstPersonPaidAt: Date | null;
    secondPersonPaidAt: Date | null;
    swishId: string | null;
    updatedAt: Date;
    updatedByUser: {
      name: string;
    } | null;
    annualBudgetItem: {
      id: string;
      name: string;
    } | null;
  };
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  payerLabels: Record<PayerType, string>;
  memberOptions: Array<{
    label: string;
    value: "FIRST_PERSON" | "SECOND_PERSON";
  }>;
  currentUserPayerType: "FIRST_PERSON" | "SECOND_PERSON";
  annualBudgetOptions: Array<{
    id: string;
    name: string;
  }>;
  selectionMode?: boolean;
  selectedParts?: Array<"FIRST_PERSON" | "SECOND_PERSON" | "FULL">;
  onToggleSelect?: (selection: {
    expenseId: string;
    targetPayerType?: "FIRST_PERSON" | "SECOND_PERSON";
  }) => void;
  onPaidStateChange?: (expenseId: string, isPaid: boolean) => void;
};

function formatShortDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function personOpenColor(
  payerType: "FIRST_PERSON" | "SECOND_PERSON",
) {
  return payerType === PayerType.FIRST_PERSON
    ? "border-[rgba(167,243,208,0.72)] bg-[#a7f3d0] text-[#052e2b]"
    : "border-[rgba(196,181,253,0.72)] bg-[#c4b5fd] text-[#24164f]";
}

const completedPersonColor =
  "border-[rgba(34,197,94,0.78)] bg-[#22c55e] text-white shadow-[0_6px_16px_rgba(34,197,94,0.18)]";

export function ExpenseItem({
  expense,
  monthId,
  returnTo,
  isLocked,
  payerLabels,
  memberOptions,
  currentUserPayerType,
  annualBudgetOptions,
  selectionMode = false,
  selectedParts = [],
  onToggleSelect,
  onPaidStateChange,
}: ExpenseItemProps) {
  const [optimisticPaid, setOptimisticPaid] = useState(expense.isPaid);
  const [optimisticPaidAt, setOptimisticPaidAt] = useState<Date | null>(expense.paidAt);
  const legacySharedPaidAt =
    expense.payerType === PayerType.SHARED && expense.isPaid
      ? expense.paidAt ?? new Date()
      : null;
  const [optimisticFirstPaidAt, setOptimisticFirstPaidAt] = useState<Date | null>(
    expense.firstPersonPaidAt ?? legacySharedPaidAt,
  );
  const [optimisticSecondPaidAt, setOptimisticSecondPaidAt] = useState<Date | null>(
    expense.secondPersonPaidAt ?? legacySharedPaidAt,
  );
  const [optimisticSwishId, setOptimisticSwishId] = useState<string | null>(expense.swishId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingPaidState, setIsSavingPaidState] = useState(false);
  const confirmedPaidState = useRef({
    paid: expense.isPaid,
    paidAt: expense.paidAt,
    firstPaidAt: expense.firstPersonPaidAt ?? legacySharedPaidAt,
    secondPaidAt: expense.secondPersonPaidAt ?? legacySharedPaidAt,
    swishId: expense.swishId,
  });
  const desiredPaidState = useRef({
    paid: expense.isPaid,
    first: Boolean(expense.firstPersonPaidAt ?? legacySharedPaidAt),
    second: Boolean(expense.secondPersonPaidAt ?? legacySharedPaidAt),
  });
  const isFlushingPaidState = useRef(false);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setErrorMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [errorMessage]);

  const secondaryText = useMemo(() => {
    const completedShares =
      Number(Boolean(optimisticFirstPaidAt)) + Number(Boolean(optimisticSecondPaidAt));
    const paidLabel =
      expense.payerType === PayerType.SHARED && !optimisticPaid
        ? `${completedShares} av 2 klara`
        : optimisticPaid && optimisticPaidAt
          ? `Betald ${formatShortDate(optimisticPaidAt)}`
          : "Obetald";

    const parts = [
      formatShortDate(expense.dueDate),
      expense.category,
      payerLabels[expense.payerType],
      expense.annualBudgetItem
        ? expense.origin === "ANNUAL_SAVING"
          ? `Automatiskt årssparande · ${expense.annualBudgetItem.name}`
          : `Sparar till ${expense.annualBudgetItem.name}`
        : null,
      optimisticSwishId ? `Swish ${optimisticSwishId}` : paidLabel,
    ].filter((value): value is string => Boolean(value));

    return parts.join(" · ");
  }, [
    expense.category,
    expense.dueDate,
    expense.origin,
    expense.payerType,
    expense.annualBudgetItem,
    optimisticFirstPaidAt,
    optimisticPaid,
    optimisticPaidAt,
    optimisticSecondPaidAt,
    optimisticSwishId,
    payerLabels,
  ]);

  const applyConfirmedPaidState = () => {
    const confirmed = confirmedPaidState.current;
    setOptimisticPaid(confirmed.paid);
    setOptimisticPaidAt(confirmed.paidAt);
    setOptimisticFirstPaidAt(confirmed.firstPaidAt);
    setOptimisticSecondPaidAt(confirmed.secondPaidAt);
    setOptimisticSwishId(confirmed.swishId);
    onPaidStateChange?.(expense.id, confirmed.paid);
  };

  const flushPaidState = async () => {
    if (isFlushingPaidState.current) {
      return;
    }

    isFlushingPaidState.current = true;
    setIsSavingPaidState(true);

    try {
      while (true) {
        const confirmed = confirmedPaidState.current;
        const desired = desiredPaidState.current;
        let targetPayerType: "FIRST_PERSON" | "SECOND_PERSON" | undefined;
        let nextPaid: boolean;

        if (expense.payerType === PayerType.SHARED) {
          const confirmedFirst = Boolean(confirmed.firstPaidAt);
          const confirmedSecond = Boolean(confirmed.secondPaidAt);

          if (confirmedFirst !== desired.first) {
            targetPayerType = PayerType.FIRST_PERSON;
            nextPaid = desired.first;
          } else if (confirmedSecond !== desired.second) {
            targetPayerType = PayerType.SECOND_PERSON;
            nextPaid = desired.second;
          } else {
            applyConfirmedPaidState();
            break;
          }
        } else if (confirmed.paid !== desired.paid) {
          nextPaid = desired.paid;
        } else {
          applyConfirmedPaidState();
          break;
        }

        const result = await toggleExpensePaidOptimisticAction({
          monthId,
          expenseId: expense.id,
          nextPaidState: nextPaid ? "paid" : "unpaid",
          targetPayerType,
          returnTo,
        });

        if (!result.ok) {
          desiredPaidState.current = {
            paid: confirmed.paid,
            first: Boolean(confirmed.firstPaidAt),
            second: Boolean(confirmed.secondPaidAt),
          };
          applyConfirmedPaidState();
          setErrorMessage(result.message ?? "Kunde inte ändra betalstatus.");
          break;
        }

        confirmedPaidState.current = {
          paid: result.isPaid,
          paidAt: result.paidAt ? new Date(result.paidAt) : null,
          firstPaidAt: result.firstPersonPaidAt
            ? new Date(result.firstPersonPaidAt)
            : null,
          secondPaidAt: result.secondPersonPaidAt
            ? new Date(result.secondPersonPaidAt)
            : null,
          swishId:
            !result.isPaid || expense.payerType === PayerType.SHARED
              ? null
              : confirmed.swishId,
        };
      }
    } finally {
      isFlushingPaidState.current = false;
      setIsSavingPaidState(false);
    }
  };

  const togglePaid = (
    targetPayerType?: "FIRST_PERSON" | "SECOND_PERSON",
  ) => {
    if (isLocked || selectionMode) {
      return;
    }

    setErrorMessage(null);
    const desired = desiredPaidState.current;
    const toggledAt = new Date();

    if (expense.payerType === PayerType.SHARED && targetPayerType) {
      if (targetPayerType === PayerType.FIRST_PERSON) {
        desired.first = !desired.first;
        setOptimisticFirstPaidAt(desired.first ? toggledAt : null);
      } else {
        desired.second = !desired.second;
        setOptimisticSecondPaidAt(desired.second ? toggledAt : null);
      }

      desired.paid = desired.first && desired.second;
      setOptimisticPaid(desired.paid);
      setOptimisticPaidAt(desired.paid ? toggledAt : null);
      setOptimisticSwishId(null);
      onPaidStateChange?.(expense.id, desired.paid);
    } else {
      desired.paid = !desired.paid;
      setOptimisticPaid(desired.paid);
      setOptimisticPaidAt(desired.paid ? toggledAt : null);
      if (!desired.paid) {
        setOptimisticSwishId(null);
      }
      onPaidStateChange?.(expense.id, desired.paid);
    }

    void flushPaidState();
  };

  const canSelect =
    selectionMode &&
    expense.payerType !== PayerType.SHARED &&
    !optimisticPaid &&
    !isLocked;
  const isSelected = selectedParts.length > 0;
  const completedSharedParts =
    Number(Boolean(optimisticFirstPaidAt)) +
    Number(Boolean(optimisticSecondPaidAt));
  const singlePayerType =
    expense.payerType === PayerType.SECOND_PERSON
      ? PayerType.SECOND_PERSON
      : PayerType.FIRST_PERSON;
  const singleMember = memberOptions.find(
    (option) => option.value === singlePayerType,
  );
  const singleInitial =
    singleMember?.label.trim().charAt(0).toLocaleUpperCase("sv") || "?";

  const renderSharedPaidButton = (
    payerType: "FIRST_PERSON" | "SECOND_PERSON",
  ) => {
    const member = memberOptions.find((option) => option.value === payerType);
    const paidAt =
      payerType === PayerType.FIRST_PERSON
        ? optimisticFirstPaidAt
        : optimisticSecondPaidAt;
    const initial = member?.label.trim().charAt(0).toLocaleUpperCase("sv") || "?";

    return (
      <button
        key={payerType}
        type="button"
        onClick={() => togglePaid(payerType)}
        disabled={isLocked}
        className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition ${
          paidAt
            ? completedPersonColor
            : personOpenColor(payerType)
        }`}
        aria-busy={isSavingPaidState}
        aria-label={
          paidAt
            ? `Markera ${member?.label ?? "person"} som inte klar`
            : `Markera ${member?.label ?? "person"} som klar`
        }
        title={member?.label}
      >
        {initial}
        {paidAt ? (
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--color-elevated)] bg-[#f4f4f5] text-[#15803d]">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </span>
        ) : null}
      </button>
    );
  };

  const renderSharedSelectionButton = (
    payerType: "FIRST_PERSON" | "SECOND_PERSON",
  ) => {
    const member = memberOptions.find((option) => option.value === payerType);
    const paidAt =
      payerType === PayerType.FIRST_PERSON
        ? optimisticFirstPaidAt
        : optimisticSecondPaidAt;
    const selected = selectedParts.includes(payerType);
    const initial = member?.label.trim().charAt(0).toLocaleUpperCase("sv") || "?";
    const disabled = Boolean(paidAt) || isLocked;

    return (
      <button
        key={payerType}
        type="button"
        onClick={() =>
          onToggleSelect?.({
            expenseId: expense.id,
            targetPayerType: payerType,
          })
        }
        disabled={disabled}
        className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition ${
          selected || paidAt
            ? completedPersonColor
            : personOpenColor(payerType)
        } ${disabled ? "opacity-55" : ""}`}
        aria-label={`${selected ? "Ta bort" : "Lägg till"} ${member?.label ?? "person"}s halva`}
        title={`${member?.label ?? "Person"} · ${formatCurrency(
          expensePartAmount(expense.amount, payerType),
        )}`}
      >
        {initial}
        {selected || paidAt ? (
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--color-elevated)] bg-[#f4f4f5] text-[#15803d]">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <article
      className={`w-full overflow-hidden rounded-[16px] border px-3 py-2.5 transition-[background-color,border-color,transform] duration-200 ${
        isSelected
          ? "border-[rgba(244,244,245,0.36)] bg-[rgba(39,39,42,0.88)]"
          : optimisticPaid
            ? "border-[rgba(34,197,94,0.28)] bg-[rgba(20,83,45,0.16)]"
            : "border-[var(--color-line)] bg-[var(--color-elevated)]"
      } ${canSelect ? "cursor-pointer" : ""}`}
      onClick={
        canSelect && onToggleSelect
          ? () => onToggleSelect({ expenseId: expense.id })
          : undefined
      }
    >
      <div className="flex items-center gap-2.5">
        {selectionMode && expense.payerType === PayerType.SHARED ? (
          <div className="flex shrink-0 items-center gap-1">
            {renderSharedSelectionButton(PayerType.FIRST_PERSON)}
            {renderSharedSelectionButton(PayerType.SECOND_PERSON)}
          </div>
        ) : selectionMode ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canSelect && onToggleSelect) {
                onToggleSelect({ expenseId: expense.id });
              }
            }}
            disabled={!canSelect}
            className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition ${
              isSelected || optimisticPaid
                ? completedPersonColor
                : personOpenColor(singlePayerType)
            } ${!canSelect ? "opacity-50" : ""}`}
            aria-label={isSelected ? "Ta bort från Swish-markering" : "Lägg till i Swish-markering"}
          >
            {singleInitial}
            {isSelected || optimisticPaid ? (
              <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--color-elevated)] bg-[#f4f4f5] text-[#15803d]">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
            ) : null}
          </button>
        ) : expense.payerType === PayerType.SHARED ? (
          <div className="flex shrink-0 items-center gap-1">
            {renderSharedPaidButton(PayerType.FIRST_PERSON)}
            {renderSharedPaidButton(PayerType.SECOND_PERSON)}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => togglePaid()}
            disabled={isLocked}
            className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition ${
              optimisticPaid
                ? completedPersonColor
                : personOpenColor(singlePayerType)
            }`}
            aria-busy={isSavingPaidState}
            aria-label={optimisticPaid ? "Markera som obetald" : "Markera som betald"}
            title={`${singleMember?.label ?? "Person"} · ${
              optimisticPaid ? "Betald" : "Obetald"
            }`}
          >
            {singleInitial}
            {optimisticPaid ? (
              <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--color-elevated)] bg-[#f4f4f5] text-[#15803d]">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
            ) : null}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">{expense.name}</p>
            <p className="shrink-0 text-[15px] font-semibold tracking-[-0.03em]">{formatCurrency(expense.amount)}</p>
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                optimisticPaid
                  ? "bg-[rgba(34,197,94,0.18)] text-[#86efac]"
                  : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
              }`}
            >
              {optimisticPaid
                ? "Betald"
                : expense.payerType === PayerType.SHARED &&
                    completedSharedParts > 0
                  ? "Delvis"
                  : "Obetald"}
            </span>
            <p className="truncate text-[11px] text-[var(--color-muted)]">{secondaryText}</p>
          </div>
        </div>

        {!selectionMode ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {expense.origin === "STANDARD" ? (
              <ModalLauncher
                title="Redigera utgift"
                description="Justera namn, belopp, kategori eller typ."
                dialogClassName="sm:max-w-xl"
                trigger={
                  <span className="icon-action-button !h-8 !w-8">
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                }
              >
                <ExpenseForm
                  monthId={monthId}
                  returnTo={returnTo}
                  isLocked={isLocked}
                  expense={expense}
                  memberOptions={memberOptions}
                  currentUserPayerType={currentUserPayerType}
                  annualBudgetOptions={annualBudgetOptions}
                />
              </ModalLauncher>
            ) : null}

            <form action={deleteExpenseAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="monthId" value={monthId} />
              <input type="hidden" name="expenseId" value={expense.id} />
              <FormStatusButton
                disabled={isLocked}
                className="icon-action-button icon-action-danger !h-8 !w-8"
                pendingLabel=""
                aria-label={
                  expense.origin === "ANNUAL_SAVING"
                    ? "Ta bort årssparandet för denna månad"
                    : "Ta bort utgift"
                }
                title={
                  expense.origin === "ANNUAL_SAVING"
                    ? "Hoppa över denna månad"
                    : "Ta bort utgift"
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </FormStatusButton>
            </form>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-2 text-[11px] font-medium text-[var(--color-danger)]">{errorMessage}</p>
      ) : null}
    </article>
  );
}
