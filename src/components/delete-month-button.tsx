import { Trash2 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { deleteMonthAction } from "@/server/actions/month-actions";

type DeleteMonthButtonProps = {
  monthId: string;
  monthKey: string;
  returnTo: string;
};

export function DeleteMonthButton({ monthId, monthKey, returnTo }: DeleteMonthButtonProps) {
  return (
    <form action={deleteMonthAction}>
      <input type="hidden" name="monthId" value={monthId} />
      <input type="hidden" name="monthKey" value={monthKey} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormStatusButton
        className="icon-action-button icon-action-danger"
        pendingLabel=""
        aria-label="Ta bort månad"
        title="Ta bort månad"
      >
        <Trash2 className="h-4 w-4" />
      </FormStatusButton>
    </form>
  );
}
