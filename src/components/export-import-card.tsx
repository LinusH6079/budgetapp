import { importHouseholdAction } from "@/server/actions/household-actions";

type ExportImportCardProps = {
  exportUrl: string;
  returnTo: string;
};

export function ExportImportCard({ exportUrl, returnTo }: ExportImportCardProps) {
  return (
    <section className="app-panel px-5 py-5 sm:px-6">
      <h2 className="section-title">Export och import</h2>
      <p className="muted mt-2">
        Exporten innehåller hushållets månader, snapshots och utgifter. Import ersätter månader med samma månadskod.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={exportUrl}
          className="rounded-2xl bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold text-white"
        >
          Exportera som JSON
        </a>
      </div>

      <form action={importHouseholdAction} className="mt-5 space-y-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="block">
          <span className="mb-2 block text-sm font-medium">JSON-fil</span>
          <input name="jsonFile" type="file" accept="application/json" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Eller klistra in JSON</span>
          <textarea
            name="jsonText"
            rows={7}
            placeholder='{"version":1,"householdName":"..."}'
            className="min-h-32"
          />
        </label>
        <button className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">
          Importera JSON
        </button>
      </form>
    </section>
  );
}
