import Link from "next/link";
import { redirect } from "next/navigation";

import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { getCurrentMonthKey } from "@/lib/date";
import { requireUser } from "@/lib/session";
import { createMonthAction } from "@/server/actions/month-actions";
import { getLatestMonthKeyForUser, getMonthsForUser } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";

type AppHomePageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function AppHomePage({ searchParams }: AppHomePageProps) {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id);
  const { notice, error } = await searchParams;

  if (!household) {
    return (
      <>
        <FlashMessage notice={notice} error={error} />
        <section className="app-panel px-5 py-8 sm:px-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-muted)]">Välkommen</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Sätt upp ert hushåll</h2>
          <p className="muted mt-3 max-w-2xl">
            Första steget är att skapa ett hushåll eller gå med via en invite-kod. Därefter kan ni skapa månader,
            fylla i inkomster och börja följa vad som faktiskt händer med pengarna.
          </p>
        </section>
        <HouseholdSetupCard />
      </>
    );
  }

  const latestMonthKey = await getLatestMonthKeyForUser(user.id);

  if (latestMonthKey) {
    redirect(`/app/months/${latestMonthKey}`);
  }

  const months = await getMonthsForUser(user.id);

  return (
    <>
      <FlashMessage notice={notice} error={error} />
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="app-panel px-5 py-8 sm:px-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-muted)]">Nästa steg</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Skapa er första budgetmånad</h2>
          <p className="muted mt-3 max-w-xl">
            Så snart en månad finns på plats kan ni fylla i inkomster, ingående saldon och utgifter. Systemet börjar
            också kunna räkna fram kvarvarande pengar och oförklarad förbrukning.
          </p>

          <form action={createMonthAction} className="mt-6 grid gap-3 sm:max-w-md">
            <input type="hidden" name="returnTo" value="/app" />
            <input type="hidden" name="copyRecurringFromMonthId" value="" />
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Månad</span>
              <input name="monthKey" defaultValue={getCurrentMonthKey()} placeholder="2026-04" required />
            </label>
            <button className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">
              Skapa första månad
            </button>
          </form>
        </div>

        <div className="app-panel px-5 py-8 sm:px-6">
          <h2 className="section-title">Hushållets status</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-2xl bg-white px-4 py-3">Hushåll: <strong>{household.name}</strong></p>
            <p className="rounded-2xl bg-white px-4 py-3">
              Medlemmar: <strong>{household.members.length} av 2</strong>
            </p>
            <p className="rounded-2xl bg-white px-4 py-3">
              Skapade månader: <strong>{months.length}</strong>
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/app/household" className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-semibold">
              Gå till hushåll
            </Link>
            <Link href="/app/months" className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-semibold">
              Visa månader
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
