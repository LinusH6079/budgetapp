import { FormStatusButton } from "@/components/form-status-button";
import { updateMonthNoteAction } from "@/server/actions/month-actions";

type MonthNotesCardProps = {
  monthId: string;
  note?: string | null;
  returnTo: string;
  isLocked: boolean;
};

export function MonthNotesCard({ monthId, note, returnTo, isLocked }: MonthNotesCardProps) {
  return (
    <section className="app-panel px-5 py-5 sm:px-6">
      <div className="px-1">
        <p className="eyebrow-label">Anteckning</p>
        <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Månadens notering</h2>
      </div>

      <form action={updateMonthNoteAction} className="mt-4">
        <input type="hidden" name="monthId" value={monthId} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <div className="surface-card px-4 py-4">
          <textarea
            name="note"
            rows={5}
            defaultValue={note ?? ""}
            placeholder="Skriv något kort om månaden"
            disabled={isLocked}
            className="min-h-[168px] rounded-[18px] px-4 py-3.5"
          />

          <div className="mt-4 flex justify-end">
            <FormStatusButton disabled={isLocked} className="action-secondary min-w-[110px]" pendingLabel="Sparar...">
              Spara
            </FormStatusButton>
          </div>
        </div>
      </form>
    </section>
  );
}
