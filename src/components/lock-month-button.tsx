import { Lock, LockOpen } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { toggleMonthLockAction } from "@/server/actions/month-actions";

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
        className="icon-action-button"
        pendingLabel=""
        aria-label={isLocked ? "Lås upp månad" : "Lås månad"}
        title={isLocked ? "Lås upp månad" : "Lås månad"}
      >
        {isLocked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </FormStatusButton>
    </form>
  );
}
