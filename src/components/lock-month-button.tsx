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
      <button
        className={`rounded-2xl px-5 py-3 text-sm font-semibold ${
          isLocked
            ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
            : "bg-[var(--color-ink)] text-white"
        }`}
      >
        {isLocked ? "Lås upp månad" : "Lås månad"}
      </button>
    </form>
  );
}
