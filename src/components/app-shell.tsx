import Link from "next/link";

import { FormStatusButton } from "@/components/form-status-button";
import { logoutAction } from "@/server/actions/auth-actions";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  householdName?: string | null;
};

const navItems = [
  { href: "/app", label: "Översikt" },
  { href: "/app/months", label: "Månader" },
  { href: "/app/household", label: "Hushåll" },
];

export function AppShell({ children, userName, householdName }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <header className="app-panel sticky top-4 z-20 mb-6 overflow-hidden px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">Budgetkompis</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
              {householdName || "Ditt hushåll"}
            </h1>
            <p className="muted mt-1">Inloggad som {userName}</p>
          </div>

          <form action={logoutAction}>
            <FormStatusButton className="action-secondary rounded-full" pendingLabel="Loggar ut...">
              Logga ut
            </FormStatusButton>
          </form>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-[var(--color-line)] bg-white/3 px-4 py-2 text-sm font-medium text-[var(--color-ink)] backdrop-blur"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
