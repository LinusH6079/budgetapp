import { FormStatusButton } from "@/components/form-status-button";
import { deleteMonthAction } from "@/server/actions/month-actions";

type DeleteMonthButtonProps = {
  monthId: string;
  monthKey: string;
  returnTo: string;
  compact?: boolean;
};

export function DeleteMonthButton({
  monthId,
  monthKey,
  returnTo,
  compact = false,
}: DeleteMonthButtonProps) {
  return (
    <form action={deleteMonthAction}>
      <input type="hidden" name="monthId" value={monthId} />
      <input type="hidden" name="monthKey" value={monthKey} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormStatusButton className="action-danger" pendingLabel="Tar bort månad...">
        {compact ? "Ta bort" : "Ta bort månad"}
      </FormStatusButton>
    </form>
  );
}
