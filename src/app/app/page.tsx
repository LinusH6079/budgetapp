import { redirect } from "next/navigation";

import { FlashMessage } from "@/components/flash-message";
import { HouseholdSetupCard } from "@/components/household-setup-card";
import { requireUser } from "@/lib/session";
import { getLatestMonthKeyForUser } from "@/server/services/budget-months";
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
        <HouseholdSetupCard />
      </>
    );
  }

  const latestMonthKey = await getLatestMonthKeyForUser(user.id);

  if (latestMonthKey) {
    redirect(`/app/months/${latestMonthKey}`);
  }

  redirect("/app/months");
}
