import Link from "next/link";

import { FormStatusButton } from "@/components/form-status-button";
import { createInviteAction } from "@/server/actions/household-actions";

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
    <section className="app-panel px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="section-title">Invite</h2>
          <p className="muted mt-1">Lägg till den andra personen med kod eller länk.</p>
        </div>

        <form action={createInviteAction}>
          <FormStatusButton disabled={householdIsFull} className="action-primary" pendingLabel="Skapar...">
            Ny invite
          </FormStatusButton>
        </form>
      </div>

      {householdIsFull ? (
        <p className="mt-4 rounded-2xl bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
          Hushållet är fullt.
        </p>
      ) : null}

      {inviteCode ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-[18px] bg-[var(--color-elevated)] px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">Kod</p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.08em]">{inviteCode}</p>
            {expiresLabel ? <p className="muted mt-2">Giltig till {expiresLabel}</p> : null}
          </div>

          {inviteUrl ? (
            <div className="rounded-[18px] bg-[var(--color-elevated)] px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">Länk</p>
              <Link href={inviteUrl} className="mt-2 block break-all text-sm font-medium text-[var(--color-ink)]">
                {inviteUrl}
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="muted mt-4 rounded-[18px] bg-[var(--color-elevated)] px-4 py-3">Ingen aktiv invite ännu.</p>
      )}
    </section>
  );
}
