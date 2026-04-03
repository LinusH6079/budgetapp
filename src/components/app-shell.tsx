"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Settings2, WalletCards, X } from "lucide-react";

import { FormStatusButton } from "@/components/form-status-button";
import { formatMonthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth-actions";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  householdName?: string | null;
};

const primaryNavItems = [
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
    return "Hushåll";
  }

  return householdName || "Budgetkompis";
}

export function AppShell({ children, userName, householdName }: AppShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pageTitle = getPageTitle(pathname, householdName);

  const sidebar = (
    <aside className="flex h-full flex-col rounded-[28px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="border-b border-[var(--color-line)] px-2 pb-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Budgetkompis</p>
        <h1 className="mt-3 text-xl font-semibold tracking-[-0.04em]">{householdName || "Hushåll"}</h1>
        <p className="muted mt-1">{userName}</p>
      </div>

      <nav className="mt-5 flex flex-col gap-1.5">
        {primaryNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                isActive
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                  : "text-[var(--color-muted)] hover:bg-white/4 hover:text-[var(--color-ink)]",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
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
      <div className="lg:hidden">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--color-line)] bg-[rgba(12,12,13,0.92)] px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Budgetkompis</p>
              <p className="mt-1 text-base font-semibold capitalize">{pageTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-elevated)] text-[var(--color-ink)]"
              aria-label={isSidebarOpen ? "Stäng meny" : "Öppna meny"}
              aria-expanded={isSidebarOpen}
            >
              {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <div
          className={cn(
            "fixed inset-0 z-30 bg-[rgba(0,0,0,0.52)] transition",
            isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setIsSidebarOpen(false)}
        />

        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[min(84vw,320px)] p-3 transition-transform duration-200",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </div>
      </div>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[296px] lg:p-5">{sidebar}</div>

      <div className="lg:pl-[296px]">
        <main className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col gap-5 px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
