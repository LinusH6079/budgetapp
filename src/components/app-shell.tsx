"use client";

import { usePathname } from "next/navigation";
import { Home, LogOut, MoreHorizontal, Settings2, WalletCards } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { NavigationProgress } from "@/components/navigation-progress";
import { PendingLink } from "@/components/pending-link";
import { formatMonthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth-actions";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  householdName?: string | null;
  latestMonthKey?: string | null;
};

const desktopNavItems = [
  { href: "/app", label: "Översikt", icon: Home },
  { href: "/app/months", label: "Månader", icon: WalletCards },
  { href: "/app/household", label: "Hushåll", icon: Settings2 },
];

function getMonthKeyFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/months\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function getPageTitle(pathname: string, householdName?: string | null) {
  if (pathname.startsWith("/app/months/")) {
    const monthKey = getMonthKeyFromPath(pathname);
    return monthKey ? formatMonthLabel(monthKey) : "Månad";
  }

  if (pathname.startsWith("/app/months")) {
    return "Månader";
  }

  if (pathname.startsWith("/app/household")) {
    return "Mer";
  }

  return householdName || "Översikt";
}

export function AppShell({ children, userName, householdName }: AppShellProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, householdName);

  const mobileNavItems = [
    {
      href: "/app",
      label: "Översikt",
      icon: Home,
      isActive: pathname === "/app",
    },
    {
      href: "/app/months",
      label: "Månader",
      icon: WalletCards,
      isActive: pathname.startsWith("/app/months"),
    },
    {
      href: "/app/household",
      label: "Mer",
      icon: MoreHorizontal,
      isActive: pathname.startsWith("/app/household"),
    },
  ];

  const sidebar = (
    <aside className="flex h-full flex-col rounded-[26px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="border-b border-[var(--color-line)] px-1 pb-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Budgetkompis</p>
        <h1 className="mt-3 text-xl font-semibold tracking-[-0.04em]">{householdName || "Hushåll"}</h1>
        <p className="muted mt-1">{userName}</p>
      </div>

      <nav className="mt-5 flex flex-col gap-1.5">
        {desktopNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <PendingLink
              key={item.href}
              href={item.href}
              prefetch
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                isActive
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                  : "text-[var(--color-muted)] hover:bg-white/4 hover:text-[var(--color-ink)]",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </PendingLink>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <form action={logoutAction}>
          <FormStatusButton className="action-secondary w-full justify-center" pendingLabel="Loggar ut...">
            Logga ut
          </FormStatusButton>
        </form>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      <NavigationProgress />
      <div className="lg:hidden">
        <header className="mobile-top-chrome sticky top-0 z-40 border-b border-[var(--color-line)] px-4 py-3.5 backdrop-blur">
          <div className="mx-auto flex max-w-[680px] items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                {householdName || "Budgetkompis"}
              </p>
              <p className="mt-1 truncate text-base font-semibold capitalize">{pageTitle}</p>
            </div>

            <form action={logoutAction}>
              <FormStatusButton
                className="icon-action-button"
                pendingLabel=""
                aria-label="Logga ut"
                title="Logga ut"
              >
                <LogOut className="h-4 w-4" />
              </FormStatusButton>
            </form>
          </div>
        </header>

        <nav className="mobile-bottom-nav mobile-bottom-chrome fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur">
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
            {mobileNavItems.map((item) => (
              <PendingLink
                key={item.href}
                href={item.href}
                prefetch
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition",
                  item.isActive
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </PendingLink>
            ))}
          </div>
        </nav>
      </div>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[288px] lg:p-5">{sidebar}</div>

      <div className="min-w-0 lg:pl-[288px]">
        <main className="mx-auto flex w-full min-w-0 max-w-[960px] flex-col gap-4 px-4 pb-28 pt-4 sm:px-5 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
