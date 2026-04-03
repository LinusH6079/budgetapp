import { headers } from "next/headers";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { FlashMessage } from "@/components/flash-message";
import { ExportImportCard } from "@/components/export-import-card";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { InviteCard } from "@/components/invite-card";
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
      <>
        <FlashMessage notice={notice} error={error} />
        <HouseholdSetupCard />
      </>
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
    <>
      <FlashMessage notice={notice} error={error} />
      <section className="app-panel px-5 py-5 sm:px-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Hushåll</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{household.name}</h2>
        <p className="muted mt-2">MVP:n stöder exakt två personer. Den som gick med först blir Person 1 i reglerna.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {members.map((member) => (
            <div key={member.userId} className="rounded-[24px] bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                {member.slot === "FIRST_PERSON" ? "Person 1" : "Person 2"}
              </p>
              <h3 className="mt-2 font-semibold">{member.name}</h3>
              <p className="muted mt-1">{member.email}</p>
              <p className="muted mt-2">{member.role === "OWNER" ? "Ägare" : "Medlem"}</p>
            </div>
          ))}

          {members.length < 2 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--color-line)] px-4 py-4">
              <p className="text-sm font-semibold">Plats för person 2</p>
              <p className="muted mt-2">Skapa en invite-kod nedan för att fylla hushållet.</p>
            </div>
          ) : null}
        </div>
      </section>

      <InviteCard
        inviteCode={latestInvite?.code ?? null}
        inviteUrl={inviteUrl}
        expiresLabel={latestInvite ? latestInvite.expiresAt.toLocaleString("sv-SE") : null}
        householdIsFull={members.length >= 2}
      />

      <ExportImportCard exportUrl="/api/export" returnTo="/app/household" />
    </>
  );
}
