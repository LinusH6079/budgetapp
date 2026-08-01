import { FormStatusButton } from "@/components/form-status-button";
import {
  createFinancingCaseAction,
  registerExistingLoanAction,
} from "@/server/actions/loan-actions";

type OwnerOption = {
  label: string;
  value: "FIRST_PERSON" | "SECOND_PERSON" | "SHARED";
};

function LoanTermsFields({
  defaultStartMonth,
  ownerOptions,
}: {
  defaultStartMonth: string;
  ownerOptions: OwnerOption[];
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Ränta</span>
          <div className="relative">
            <input
              name="annualInterestRate"
              inputMode="decimal"
              placeholder="4,50"
              required
              className="pr-9"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">%</span>
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Löptid, månader</span>
          <input name="termMonths" inputMode="numeric" placeholder="60" required />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Uppläggningsavgift</span>
          <input name="setupFee" inputMode="decimal" defaultValue="0" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Månadsavgift</span>
          <input name="monthlyFee" inputMode="decimal" defaultValue="0" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Amortering</span>
          <select name="amortizationType" defaultValue="ANNUITY">
            <option value="ANNUITY">Annuitet</option>
            <option value="STRAIGHT">Rak amortering</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Första budgetmånad</span>
          <input name="startMonth" type="month" defaultValue={defaultStartMonth} required />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">Betalas av</span>
        <select name="payerType" defaultValue="SHARED">
          {ownerOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    </>
  );
}

export function FinancingCaseForm({
  defaultStartMonth,
  ownerOptions,
}: {
  defaultStartMonth: string;
  ownerOptions: OwnerOption[];
}) {
  return (
    <form action={createFinancingCaseAction} className="grid gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">Namn</span>
        <input name="name" placeholder="Bil, renovering..." required />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Kontantpris</span>
          <input name="purchasePrice" inputMode="decimal" placeholder="250000" required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Kontantinsats</span>
          <input name="downPayment" inputMode="decimal" defaultValue="0" />
        </label>
      </div>
      <LoanTermsFields defaultStartMonth={defaultStartMonth} ownerOptions={ownerOptions} />
      <FormStatusButton className="action-primary w-full justify-center" pendingLabel="Räknar...">
        Jämför alternativen
      </FormStatusButton>
    </form>
  );
}

export function ExistingLoanForm({
  defaultStartMonth,
  ownerOptions,
}: {
  defaultStartMonth: string;
  ownerOptions: OwnerOption[];
}) {
  return (
    <form action={registerExistingLoanAction} className="grid gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">Lånets namn</span>
        <input name="name" placeholder="Billån" required />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">Restskuld</span>
        <input name="principal" inputMode="decimal" placeholder="180000" required />
      </label>
      <LoanTermsFields defaultStartMonth={defaultStartMonth} ownerOptions={ownerOptions} />
      <FormStatusButton className="action-primary w-full justify-center" pendingLabel="Skapar plan...">
        Registrera befintligt lån
      </FormStatusButton>
    </form>
  );
}
