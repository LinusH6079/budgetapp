import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/session";
import { getHouseholdForUser } from "@/server/services/households";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id);

  return (
    <AppShell userName={user.name ?? user.email ?? "Användare"} householdName={household?.name}>
      {children}
    </AppShell>
  );
}
