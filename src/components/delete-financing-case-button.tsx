"use client";

import { Trash2 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { deleteFinancingCaseAction } from "@/server/actions/loan-actions";

export function DeleteFinancingCaseButton({ caseId }: { caseId: string }) {
  return (
    <form
      action={deleteFinancingCaseAction}
      onSubmit={(event) => {
        if (!window.confirm("Ta bort den här jämförelsen?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="caseId" value={caseId} />
      <FormStatusButton
        className="icon-action-button icon-action-danger !h-8 !w-8"
        pendingLabel=""
        aria-label="Ta bort jämförelse"
        title="Ta bort jämförelse"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </FormStatusButton>
    </form>
  );
}
