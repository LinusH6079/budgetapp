import { headers } from "next/headers";

import { ExportImportCard } from "@/components/export-import-card";
import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { InviteCard } from "@/components/invite-card";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getHouseholdForUser, mapMembersToSlots } from "@/server/services/households";

type HouseholdPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function HouseholdPage({ searchParams }: HouseholdPageProps) {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id);
  const { notice, error } = await searchParams;

  if (!household) {
    return (
      <div className="viewport-page">
        <FlashMessage notice={notice} error={error} />
        <HouseholdSetupCard />
      </div>
    );
  }

  const latestInvite = await db.householdInvite.findFirst({
    where: {
      householdId: household.id,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const members = mapMembersToSlots(household);
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  const inviteUrl = latestInvite ? `${baseUrl}/register?invite=${latestInvite.code}` : null;

  return (
    <div className="viewport-page">
      <FlashMessage notice={notice} error={error} />

      <section className="app-panel px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow-label">Hushåll</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">{household.name}</h2>
            <p className="muted mt-1">2 personer max</p>
          </div>
          <span className="text-sm text-[var(--color-muted)]">{members.length}/2</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((member) => (
            <div key={member.userId} className="surface-card content-auto">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                {member.slot === "FIRST_PERSON" ? "Person 1" : "Person 2"}
              </p>
              <h3 className="mt-2 font-semibold">{member.name}</h3>
              <p className="muted mt-1">{member.email}</p>
            </div>
          ))}

          {members.length < 2 ? (
            <div className="ghost-panel px-4 py-4 text-sm text-[var(--color-muted)]">Plats för en till.</div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <InviteCard
          inviteCode={latestInvite?.code ?? null}
          inviteUrl={inviteUrl}
          expiresLabel={latestInvite ? latestInvite.expiresAt.toLocaleString("sv-SE") : null}
          householdIsFull={members.length >= 2}
        />

        <ExportImportCard exportUrl="/api/export" returnTo="/app/household" />
      </div>
    </div>
  );
}
