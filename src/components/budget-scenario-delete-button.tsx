"use client";

import { Trash2 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { deleteBudgetScenarioAction } from "@/server/actions/budget-scenario-actions";

export function BudgetScenarioDeleteButton({ scenarioId }: { scenarioId: string }) {
  return (
    <form
      action={deleteBudgetScenarioAction}
      onSubmit={(event) => {
        if (!window.confirm("Ta bort den här testbudgeten? Det går inte att ångra.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="scenarioId" value={scenarioId} />
      <input type="hidden" name="returnTo" value="/app/playground" />
      <FormStatusButton className="icon-action-button icon-action-danger" pendingLabel="" title="Ta bort testbudget" aria-label="Ta bort testbudget">
        <Trash2 className="h-4 w-4" />
      </FormStatusButton>
    </form>
  );
}
