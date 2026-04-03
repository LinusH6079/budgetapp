import { toggleMonthLockAction } from "@/server/actions/month-actions";
import { FormStatusButton } from "@/components/form-status-button";

type LockMonthButtonProps = {
  monthId: string;
  returnTo: string;
  isLocked: boolean;
};

export function LockMonthButton({ monthId, returnTo, isLocked }: LockMonthButtonProps) {
  return (
    <form action={toggleMonthLockAction}>
      <input type="hidden" name="monthId" value={monthId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="nextLockedState" value={isLocked ? "unlock" : "lock"} />
      <FormStatusButton
        className="action-secondary"
        pendingLabel={isLocked ? "Låser upp..." : "Låser..."}
      >
        {isLocked ? "Lås upp månad" : "Lås månad"}
      </FormStatusButton>
    </form>
  );
}
