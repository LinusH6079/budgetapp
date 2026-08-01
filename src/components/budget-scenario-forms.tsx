import { Copy, Pencil, Rocket, Trash2 } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { ModalLauncher } from "@/components/modal-launcher";
import { formatEditableAmount } from "@/lib/money";
import {
  deleteScenarioExpenseAction,
  duplicateBudgetScenarioAction,
  promoteBudgetScenarioAction,
  renameBudgetScenarioAction,
  saveScenarioExpenseAction,
  updateBudgetScenarioNoteAction,
  updateScenarioSnapshotAction,
} from "@/server/actions/budget-scenario-actions";

type MemberOption = { userId: string; name: string; slot: "FIRST_PERSON" | "SECOND_PERSON" };
type ScenarioExpense = {
  id: string;
  name: string;
  amount: number;
  category: string;
  expenseType: "RECURRING" | "ONE_TIME";
  payerType: "FIRST_PERSON" | "SECOND_PERSON" | "SHARED";
};

export function ScenarioExpenseForm({ scenarioId, returnTo, members, expense }: {
  scenarioId: string; returnTo: string; members: MemberOption[]; expense?: ScenarioExpense;
}) {
  return (
    <form action={saveScenarioExpenseAction} className="grid gap-3">
      <input type="hidden" name="scenarioId" value={scenarioId} />
      <input type="hidden" name="expenseId" value={expense?.id ?? ""} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label><span className="mb-1.5 block text-xs font-medium">Namn</span><input name="name" defaultValue={expense?.name ?? ""} required /></label>
      <div className="grid grid-cols-2 gap-2.5">
        <label><span className="mb-1.5 block text-xs font-medium">Belopp</span><input name="amount" inputMode="decimal" defaultValue={expense ? formatEditableAmount(expense.amount) : ""} required /></label>
        <label><span className="mb-1.5 block text-xs font-medium">Kategori</span><input name="category" defaultValue={expense?.category ?? ""} required /></label>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label><span className="mb-1.5 block text-xs font-medium">Typ</span><select name="expenseType" defaultValue={expense?.expenseType ?? "ONE_TIME"}><option value="ONE_TIME">Engångs</option><option value="RECURRING">Återkommande</option></select></label>
        <label><span className="mb-1.5 block text-xs font-medium">Person</span><select name="payerType" defaultValue={expense?.payerType ?? members[0]?.slot ?? "FIRST_PERSON"}>{members.map((member) => <option key={member.userId} value={member.slot}>{member.name}</option>)}<option value="SHARED">Båda, 50/50</option></select></label>
      </div>
      <FormStatusButton className="action-primary mt-1 w-full justify-center" pendingLabel="Sparar...">{expense ? "Spara ändring" : "Lägg till utgift"}</FormStatusButton>
    </form>
  );
}

export function ScenarioIncomeForms({ scenarioId, returnTo, snapshots }: {
  scenarioId: string; returnTo: string; snapshots: Array<{ userId: string; incomeAmount: number; carryOverAmount: number; user: { name: string } }>;
}) {
  return <section className="grid gap-2.5">{snapshots.map((snapshot) => (
    <form key={snapshot.userId} action={updateScenarioSnapshotAction} className="app-panel px-4 py-4">
      <input type="hidden" name="scenarioId" value={scenarioId} /><input type="hidden" name="userId" value={snapshot.userId} /><input type="hidden" name="returnTo" value={returnTo} />
      <h3 className="text-sm font-semibold">{snapshot.user.name}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <label><span className="mb-1.5 block text-xs text-[var(--color-muted)]">Inkomst</span><input name="incomeAmount" inputMode="decimal" defaultValue={formatEditableAmount(snapshot.incomeAmount)} /></label>
        <label><span className="mb-1.5 block text-xs text-[var(--color-muted)]">Saldo in</span><input name="carryOverAmount" inputMode="decimal" defaultValue={formatEditableAmount(snapshot.carryOverAmount)} /></label>
      </div>
      <div className="mt-3 flex justify-end"><FormStatusButton className="action-secondary" pendingLabel="Sparar...">Spara</FormStatusButton></div>
    </form>
  ))}</section>;
}

export function ScenarioNotesForm({ scenarioId, note, returnTo }: { scenarioId: string; note: string | null; returnTo: string }) {
  return <form action={updateBudgetScenarioNoteAction} className="app-panel px-4 py-4"><input type="hidden" name="scenarioId" value={scenarioId} /><input type="hidden" name="returnTo" value={returnTo} /><p className="eyebrow-label">Anteckning</p><textarea name="note" rows={5} defaultValue={note ?? ""} className="mt-3 min-h-36" placeholder="Vad testar ni i scenariot?" /><div className="mt-3 flex justify-end"><FormStatusButton className="action-secondary" pendingLabel="Sparar...">Spara</FormStatusButton></div></form>;
}

export function ScenarioManagement({ scenarioId, name, referenceMonthKey, returnTo }: { scenarioId: string; name: string; referenceMonthKey: string; returnTo: string }) {
  return <div className="flex items-center gap-1.5">
    <ModalLauncher title="Byt namn" trigger={<span className="icon-action-button"><Pencil className="h-4 w-4" /></span>}><form action={renameBudgetScenarioAction} className="grid gap-3"><input type="hidden" name="scenarioId" value={scenarioId} /><input type="hidden" name="returnTo" value={returnTo} /><input name="name" defaultValue={name} required /><FormStatusButton className="action-primary justify-center">Spara namn</FormStatusButton></form></ModalLauncher>
    <form action={duplicateBudgetScenarioAction}><input type="hidden" name="scenarioId" value={scenarioId} /><FormStatusButton className="icon-action-button" pendingLabel="" title="Duplicera" aria-label="Duplicera"><Copy className="h-4 w-4" /></FormStatusButton></form>
    <ModalLauncher title="Skapa riktig månad" description="Automatiska lån och årssparanden hämtas från aktuella planer." trigger={<span className="icon-action-button action-primary"><Rocket className="h-4 w-4" /></span>}><form action={promoteBudgetScenarioAction} className="grid gap-3"><input type="hidden" name="scenarioId" value={scenarioId} /><input type="hidden" name="returnTo" value={returnTo} /><label><span className="mb-1.5 block text-xs font-medium">Ny månad</span><input name="targetMonthKey" defaultValue={referenceMonthKey} required /></label><FormStatusButton className="action-primary justify-center" pendingLabel="Skapar...">Skapa månad</FormStatusButton></form></ModalLauncher>
  </div>;
}

export function ScenarioExpenseActions({ scenarioId, returnTo, members, expense }: { scenarioId: string; returnTo: string; members: MemberOption[]; expense: ScenarioExpense & { isSystemGenerated: boolean } }) {
  return <div className="flex items-center gap-1">
    <ModalLauncher title="Redigera utgift" trigger={<span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)]"><Pencil className="h-3.5 w-3.5" /></span>}><ScenarioExpenseForm scenarioId={scenarioId} returnTo={returnTo} members={members} expense={expense} /></ModalLauncher>
    <form action={deleteScenarioExpenseAction}><input type="hidden" name="scenarioId" value={scenarioId} /><input type="hidden" name="expenseId" value={expense.id} /><input type="hidden" name="returnTo" value={returnTo} /><FormStatusButton className="!h-8 !w-8 !p-0 text-[var(--color-muted)]" pendingLabel="" title="Ta bort" aria-label="Ta bort"><Trash2 className="h-3.5 w-3.5" /></FormStatusButton></form>
  </div>;
}
