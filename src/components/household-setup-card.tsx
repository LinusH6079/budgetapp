import { createHouseholdAction, joinHouseholdAction } from "@/server/actions/household-actions";

type HouseholdSetupCardProps = {
  notice?: string;
  error?: string;
};

export function HouseholdSetupCard({ notice, error }: HouseholdSetupCardProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="app-panel px-5 py-5 sm:px-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Steg 1</p>
        <h2 className="section-title mt-2">Skapa hushåll</h2>
        <p className="muted mt-2">Starta ert gemensamma hushåll och bjud in den andra personen senare.</p>
        <form action={createHouseholdAction} className="mt-5 space-y-3">
          <input name="name" placeholder="Till exempel Hemma hos oss" required />
          <button className="rounded-2xl bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold text-white">
            Skapa hushåll
          </button>
        </form>
      </div>

      <div className="app-panel px-5 py-5 sm:px-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Steg 2</p>
        <h2 className="section-title mt-2">Gå med via kod</h2>
        <p className="muted mt-2">Om din partner redan har skapat hushållet kan du gå med direkt här.</p>
        <form action={joinHouseholdAction} className="mt-5 space-y-3">
          <input name="code" placeholder="Till exempel 3FA9C1D0" required />
          <button className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">
            Gå med i hushåll
          </button>
        </form>

        {notice || error ? (
          <p className="muted mt-4 rounded-2xl bg-white px-4 py-3">{error || notice}</p>
        ) : null}
      </div>
    </section>
  );
}
