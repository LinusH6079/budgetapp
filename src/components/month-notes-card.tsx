import { updateMonthNoteAction } from "@/server/actions/month-actions";
import { FormStatusButton } from "@/components/form-status-button";

type MonthNotesCardProps = {
  monthId: string;
  note?: string | null;
  returnTo: string;
  isLocked: boolean;
};

export function MonthNotesCard({ monthId, note, returnTo, isLocked }: MonthNotesCardProps) {
  return (
    <section className="app-panel px-5 py-5 sm:px-6">
      <h2 className="section-title">Månadens anteckning</h2>
      <p className="muted mt-2">Lägg till kort kontext, till exempel semester, renovering eller ovanligt höga kostnader.</p>
      <form action={updateMonthNoteAction} className="mt-4 space-y-3">
        <input type="hidden" name="monthId" value={monthId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <textarea
          name="note"
          rows={4}
          defaultValue={note ?? ""}
          placeholder="Till exempel: Sommarsemester och service på bilen."
          disabled={isLocked}
        />
        <FormStatusButton
          disabled={isLocked}
          className="action-secondary"
          pendingLabel="Sparar anteckning..."
        >
          Spara anteckning
        </FormStatusButton>
      </form>
    </section>
  );
}
