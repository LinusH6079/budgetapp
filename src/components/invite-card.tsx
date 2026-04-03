import Link from "next/link";

import { createInviteAction } from "@/server/actions/household-actions";
import { FormStatusButton } from "@/components/form-status-button";

type InviteCardProps = {
  inviteCode?: string | null;
  inviteUrl?: string | null;
  expiresLabel?: string | null;
  householdIsFull: boolean;
};

export function InviteCard({
  inviteCode,
  inviteUrl,
  expiresLabel,
  householdIsFull,
}: InviteCardProps) {
  return (
    <section className="app-panel px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Invite</h2>
          <p className="muted mt-2">
            Dela en kod eller länk för att låta den andra personen gå med i hushållet.
          </p>
        </div>

        <form action={createInviteAction}>
          <FormStatusButton
            disabled={householdIsFull}
            className="action-primary"
            pendingLabel="Skapar invite..."
          >
            Skapa ny invite
          </FormStatusButton>
        </form>
      </div>

      {householdIsFull ? (
        <p className="mt-4 rounded-2xl bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-accent)]">
          Hushållet är fullt. Invite-koder behövs inte längre.
        </p>
      ) : null}

      {inviteCode ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Kod</p>
            <p className="mt-3 font-mono text-2xl font-semibold">{inviteCode}</p>
            {expiresLabel ? <p className="muted mt-2">Giltig till {expiresLabel}</p> : null}
          </div>

          <div className="rounded-3xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Registreringslänk</p>
            {inviteUrl ? (
              <Link href={inviteUrl} className="mt-3 block break-all text-sm font-medium text-[var(--color-accent)]">
                {inviteUrl}
              </Link>
            ) : (
              <p className="muted mt-3">Skapa en invite först.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="muted mt-4 rounded-2xl bg-[color:var(--color-elevated)] px-4 py-3">Ingen aktiv invite ännu.</p>
      )}
    </section>
  );
}
