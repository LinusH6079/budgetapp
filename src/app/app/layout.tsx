import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/session";
import { getLatestMonthKeyForUser } from "@/server/services/budget-months";
import { getHouseholdForUser } from "@/server/services/households";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [household, latestMonthKey] = await Promise.all([
    getHouseholdForUser(user.id),
    getLatestMonthKeyForUser(user.id),
  ]);

  return (
    <AppShell
      userName={user.name ?? user.email ?? "Användare"}
      householdName={household?.name}
      latestMonthKey={latestMonthKey}
    >
      {children}
    </AppShell>
  );
}
