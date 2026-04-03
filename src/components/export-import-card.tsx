import { Download, Upload } from "lucide-react";

import { ModalLauncher } from "@/components/modal-launcher";
import { importHouseholdAction } from "@/server/actions/household-actions";

type ExportImportCardProps = {
  exportUrl: string;
  returnTo: string;
};

export function ExportImportCard({ exportUrl, returnTo }: ExportImportCardProps) {
  return (
    <section className="app-panel px-4 py-4 sm:px-5">
      <h2 className="section-title">Backup</h2>
      <p className="muted mt-1">Exportera eller återställ hushållets data när du behöver det.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a href={exportUrl} className="action-button action-secondary justify-center">
          <Download className="h-4 w-4" />
          Exportera JSON
        </a>

        <ModalLauncher
          title="Importera JSON"
          description="Import ersätter månader med samma månadskod."
          trigger={
            <span className="action-button action-secondary w-full justify-center">
              <Upload className="h-4 w-4" />
              Importera
            </span>
          }
          dialogClassName="sm:max-w-xl"
        >
          <form action={importHouseholdAction} className="grid gap-3">
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">JSON-fil</span>
              <input name="jsonFile" type="file" accept="application/json" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Eller klistra in JSON</span>
              <textarea
                name="jsonText"
                rows={7}
                placeholder='{"version":1,"householdName":"..."}'
                className="min-h-32"
              />
            </label>
            <button className="action-button action-primary w-full justify-center">Importera JSON</button>
          </form>
        </ModalLauncher>
      </div>
    </section>
  );
}
