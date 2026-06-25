import { headers } from "next/headers";

import { ExportImportCard } from "@/components/export-import-card";
import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { InviteCard } from "@/components/invite-card";
import { db } from "@/lib/db";
import { formatMonthLabel } from "@/lib/date";
import { formatCurrency } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { swishSearchSchema } from "@/lib/validations";
import { getExpensesBySwishIdForUser } from "@/server/services/expenses";
import { getHouseholdForUser, mapMembersToSlots } from "@/server/services/households";

type HouseholdPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
    swishId?: string;
  }>;
};

export default async function HouseholdPage({ searchParams }: HouseholdPageProps) {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id);
  const { notice, error, swishId } = await searchParams;

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
  const parsedSwishSearch = swishId ? swishSearchSchema.safeParse({ swishId }) : null;
  const swishSearchResult =
    parsedSwishSearch && parsedSwishSearch.success
      ? await getExpensesBySwishIdForUser({
          actorUserId: user.id,
          swishId: parsedSwishSearch.data.swishId,
        })
      : null;

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

      <section className="app-panel px-4 py-4 sm:px-5">
        <p className="eyebrow-label">Swish-sök</p>
        <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Hitta utgifter via Swish ID</h2>

        <form method="get" className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Swish ID</span>
            <input name="swishId" defaultValue={swishId ?? ""} placeholder="SWISH-2026-001" />
          </label>
          <button className="action-button action-primary self-end justify-center">Sök</button>
        </form>

        {parsedSwishSearch && !parsedSwishSearch.success ? (
          <p className="mt-3 text-sm text-[var(--color-danger)]">
            {parsedSwishSearch.error.issues[0]?.message ?? "Ogiltigt Swish ID."}
          </p>
        ) : null}

        {swishSearchResult ? (
          <div className="mt-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-elevated)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Swish {swishSearchResult.swishId}</p>
                <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                  {swishSearchResult.expenses.length} utgifter hittades
                </p>
              </div>
              <p className="text-base font-semibold">{formatCurrency(swishSearchResult.totalAmount)}</p>
            </div>

            <div className="mt-4 grid gap-2.5">
              {swishSearchResult.expenses.length > 0 ? (
                swishSearchResult.expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="rounded-[16px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{expense.name}</p>
                        <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                          {formatMonthLabel(expense.budgetMonth.monthKey)} · {expense.category}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{formatCurrency(expense.amount)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--color-muted)]">Ingen utgift hittades för det ID:t.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
