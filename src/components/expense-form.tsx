"use client";

import { ExpenseType, PayerType } from "@prisma/client";
import { Check } from "lucide-react";
import { useState } from "react";

import { FormStatusButton } from "@/components/form-status-button";
import { formatEditableAmount } from "@/lib/money";
import { saveExpenseAction } from "@/server/actions/expense-actions";

type ExpenseFormProps = {
  monthId: string;
  returnTo: string;
  isLocked: boolean;
  expense?: {
    id: string;
    name: string;
    amount: number;
    category: string;
    expenseType: ExpenseType;
    payerType: PayerType;
    isPaid: boolean;
    paidAt: Date | null;
    annualBudgetItem: {
      id: string;
      name: string;
    } | null;
  };
  memberOptions: Array<{
    label: string;
    value: "FIRST_PERSON" | "SECOND_PERSON";
  }>;
  currentUserPayerType: "FIRST_PERSON" | "SECOND_PERSON";
  annualBudgetOptions: Array<{
    id: string;
    name: string;
  }>;
};

export function ExpenseForm({
  monthId,
  returnTo,
  isLocked,
  expense,
  memberOptions,
  currentUserPayerType,
  annualBudgetOptions,
}: ExpenseFormProps) {
  const initialPayers =
    expense?.payerType === PayerType.SHARED
      ? memberOptions.map((option) => option.value)
      : [expense?.payerType ?? currentUserPayerType];
  const [selectedPayers, setSelectedPayers] = useState<
    Array<"FIRST_PERSON" | "SECOND_PERSON">
  >(initialPayers);
  const payerType =
    selectedPayers.length === 2 ? PayerType.SHARED : selectedPayers[0];

  const togglePayer = (
    value: "FIRST_PERSON" | "SECOND_PERSON",
  ) => {
    setSelectedPayers((current) => {
      if (current.includes(value)) {
        return current.length === 1
          ? current
          : current.filter((payer) => payer !== value);
      }

      return [...current, value];
    });
  };

  return (
    <form
      action={saveExpenseAction}
      className="grid gap-2.5"
      onSubmit={() => window.dispatchEvent(new CustomEvent("app:navigation-start"))}
    >
      <input type="hidden" name="monthId" value={monthId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="expenseId" value={expense?.id ?? ""} />
      <input type="hidden" name="payerType" value={payerType} />

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Namn</span>
          <input name="name" defaultValue={expense?.name} placeholder="Hyra" disabled={isLocked} required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Belopp</span>
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={expense ? formatEditableAmount(expense.amount) : ""}
            placeholder="1200"
            disabled={isLocked}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Kategori</span>
          <input
            name="category"
            defaultValue={expense?.category}
            placeholder="Boende"
            disabled={isLocked}
            required
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Typ</span>
          <select name="expenseType" defaultValue={expense?.expenseType ?? ExpenseType.ONE_TIME} disabled={isLocked}>
            <option value={ExpenseType.ONE_TIME}>Engångs</option>
            <option value={ExpenseType.RECURRING}>Återkommande</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">
            Spara till årskostnad <span className="text-[var(--color-muted)]">(valfritt)</span>
          </span>
          <select
            name="annualBudgetItemId"
            defaultValue={expense?.annualBudgetItem?.id ?? ""}
            disabled={isLocked}
          >
            <option value="">Ingen årskostnad</option>
            {annualBudgetOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
            Beloppet räknas som sparat när utgiften markeras betald.
          </p>
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Tilldelad</legend>
          <div className="grid grid-cols-2 gap-2">
            {memberOptions.map((option) => {
              const selected = selectedPayers.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePayer(option.value)}
                  disabled={isLocked}
                  aria-pressed={selected}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-[12px] border px-3 text-left text-sm font-medium transition ${
                    selected
                      ? "border-[rgba(244,244,245,0.34)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                      : "border-[var(--color-line)] bg-[var(--color-elevated)] text-[var(--color-muted)]"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      selected
                        ? "bg-[var(--color-accent-strong)] text-[#09090b]"
                        : "border border-[var(--color-line)]"
                    }`}
                  >
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedPayers.length === 2 ? (
            <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
              Beloppet delas lika mellan båda.
            </p>
          ) : null}
        </fieldset>
      </div>

      <FormStatusButton
        disabled={isLocked}
        className="action-primary mt-1 w-full justify-center"
        pendingLabel={expense ? "Sparar..." : "Lägger till..."}
      >
        {expense ? "Spara" : "Lägg till"}
      </FormStatusButton>
    </form>
  );
}
