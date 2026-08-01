"use client";

import { useState } from "react";

import { FormStatusButton } from "@/components/form-status-button";
import { formatEditableAmount } from "@/lib/money";
import { saveAnnualBudgetItemAction } from "@/server/actions/annual-budget-actions";

type AnnualBudgetFormProps = {
  defaultDueMonth: string;
  defaultStartMonth: string;
  item?: {
    id: string;
    name: string;
    targetAmount: number;
    savingStartMonth: string | null;
    dueMonth: string;
    category: string | null;
    recurrence: "ONE_TIME" | "YEARLY";
    savingMode: "TARGET_BY_DATE" | "CUSTOM_SCHEDULE";
  };
};

export function AnnualBudgetForm({
  defaultDueMonth,
  defaultStartMonth,
  item,
}: AnnualBudgetFormProps) {
  const [savingMode, setSavingMode] = useState<
    "TARGET_BY_DATE" | "CUSTOM_SCHEDULE"
  >(item?.savingMode ?? "TARGET_BY_DATE");

  return (
    <form action={saveAnnualBudgetItemAction} className="grid gap-3">
      <input type="hidden" name="itemId" value={item?.id ?? ""} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Namn</span>
        <input
          name="name"
          defaultValue={item?.name}
          placeholder="Bilservice"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Målbelopp</span>
        <input
          name="targetAmount"
          inputMode="decimal"
          defaultValue={item ? formatEditableAmount(item.targetAmount) : ""}
          placeholder="8000"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Första sparmånad
          </span>
          <input
            name="savingStartMonth"
            type="month"
            defaultValue={item?.savingStartMonth ?? defaultStartMonth}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Sista sparmånad
          </span>
          <input
            name="dueMonth"
            type="month"
            defaultValue={item?.dueMonth ?? defaultDueMonth}
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Sparmodell</span>
        <select
          name="savingMode"
          value={savingMode}
          onChange={(event) =>
            setSavingMode(
              event.target.value as "TARGET_BY_DATE" | "CUSTOM_SCHEDULE",
            )
          }
        >
          <option value="TARGET_BY_DATE">Nå målet till datum</option>
          <option value="CUSTOM_SCHEDULE">Flexibel målplan</option>
        </select>
      </label>

      {savingMode === "CUSTOM_SCHEDULE" && !item ? (
        <div className="rounded-[16px] border border-[var(--color-line)] bg-white/[0.025] p-3">
          <p className="text-xs font-semibold">Tillfälligt månadsbelopp</p>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] text-[var(--color-muted)]">
                Från månad
              </span>
              <input
                name="initialSavingMonth"
                type="month"
                defaultValue={defaultStartMonth}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] text-[var(--color-muted)]">
                Till och med
              </span>
              <input
                name="initialSavingEndMonth"
                type="month"
                required
              />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1.5 block text-[11px] text-[var(--color-muted)]">
                Belopp per månad
              </span>
              <input
                name="initialMonthlyAmount"
                inputMode="decimal"
                placeholder="3000"
                required
              />
            </label>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-muted)]">
            Efter slutmånaden räknar appen automatiskt om takten så att målet
            fortfarande nås vid milstolpen. Fler perioder kan läggas till senare.
          </p>
        </div>
      ) : savingMode === "TARGET_BY_DATE" ? (
        <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
          Första och sista sparmånaden räknas med. Augusti till oktober ger
          alltså tre sparmånader.
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Upprepning</span>
        <select
          name="recurrence"
          defaultValue={item?.recurrence ?? "ONE_TIME"}
        >
          <option value="ONE_TIME">En gång</option>
          <option value="YEARLY">Varje år</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Kategori <span className="text-[var(--color-muted)]">(valfritt)</span>
        </span>
        <input
          name="category"
          defaultValue={item?.category ?? ""}
          placeholder="Bil"
        />
      </label>

      <FormStatusButton
        className="action-primary mt-1 w-full justify-center"
        pendingLabel="Sparar..."
      >
        {item ? "Spara ändringar" : "Skapa årskostnad"}
      </FormStatusButton>
    </form>
  );
}
