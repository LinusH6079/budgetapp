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
      <h2 className="section-title">Anteckning</h2>
      <form action={updateMonthNoteAction} className="mt-4 space-y-3">
        <input type="hidden" name="monthId" value={monthId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <textarea
          name="note"
          rows={4}
          defaultValue={note ?? ""}
          placeholder="Skriv något kort om månaden"
          disabled={isLocked}
        />
        <FormStatusButton disabled={isLocked} className="action-secondary" pendingLabel="Sparar...">
          Spara
        </FormStatusButton>
      </form>
    </section>
  );
}
