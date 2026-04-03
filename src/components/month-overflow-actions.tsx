"use client";

import { useState } from "react";
import { Ellipsis, Lock, LockOpen, Trash2 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { deleteMonthAction, toggleMonthLockAction } from "@/server/actions/month-actions";

type MonthOverflowActionsProps = {
  monthId: string;
  monthKey: string;
  isLocked: boolean;
  returnTo: string;
};

export function MonthOverflowActions({
  monthId,
  monthKey,
  isLocked,
  returnTo,
}: MonthOverflowActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <ModalLauncher
      title="Månadshantering"
      description="Lås eller ta bort den här månaden."
      trigger={
        <span className="icon-action-button">
          <Ellipsis className="h-4 w-4" />
        </span>
      }
      dialogClassName="sm:max-w-md"
    >
      <div className="grid gap-3">
        <form action={toggleMonthLockAction}>
          <input type="hidden" name="monthId" value={monthId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="nextLockedState" value={isLocked ? "unlock" : "lock"} />
          <FormStatusButton className="action-secondary w-full justify-center" pendingLabel="Sparar...">
            {isLocked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {isLocked ? "Lås upp månad" : "Lås månad"}
          </FormStatusButton>
        </form>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="action-button action-danger w-full justify-center"
          >
            <Trash2 className="h-4 w-4" />
            Ta bort månad
          </button>
        ) : (
          <div className="rounded-[18px] border border-[var(--color-danger)]/20 bg-[var(--color-danger-soft)] px-4 py-4">
            <p className="text-sm font-medium text-[var(--color-danger)]">Bekräfta borttagning av {monthKey}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Det här går inte att ångra.</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="action-button action-secondary justify-center"
              >
                Avbryt
              </button>

              <form action={deleteMonthAction}>
                <input type="hidden" name="monthId" value={monthId} />
                <input type="hidden" name="monthKey" value={monthKey} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <FormStatusButton className="action-danger w-full justify-center" pendingLabel="Tar bort...">
                  Bekräfta
                </FormStatusButton>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModalLauncher>
  );
}
