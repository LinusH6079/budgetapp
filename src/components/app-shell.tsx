"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Menu, Plus, Settings2, WalletCards, X } from "lucide-react";

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

const monthSectionItems = [
  { id: "month-top", label: "Månadsöversikt" },
  { id: "month-summary", label: "Summering" },
  { id: "month-household", label: "Personer" },
  { id: "month-expenses", label: "Utgifter" },
  { id: "month-categories", label: "Kategorier" },
  { id: "month-notes", label: "Anteckning" },
  { id: "month-status", label: "Status" },
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
  const isMonthPage = /^\/app\/months\/[^/]+$/.test(pathname);
  const monthKey = getMonthKeyFromPath(pathname);
  const pageTitle = getPageTitle(pathname, householdName);

  const sidebar = (
    <aside className="flex h-full flex-col rounded-[32px] border border-[var(--color-line)] bg-[rgba(7,12,22,0.92)] p-4 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div className="border-b border-[var(--color-line)] px-2 pb-4">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-accent)]">Budgetkompis</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
          {householdName || "Ditt hushåll"}
        </h1>
        <p className="muted mt-2">Inloggad som {userName}</p>
      </div>

      <nav className="mt-5 flex flex-col gap-2">
        {primaryNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                  : "text-[var(--color-muted)] hover:bg-white/4 hover:text-[var(--color-ink)]",
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition",
                  isActive ? "text-[var(--color-accent)]" : "text-transparent group-hover:text-[var(--color-muted)]",
                )}
              />
            </Link>
          );
        })}
      </nav>

      {isMonthPage && monthKey ? (
        <div className="mt-6 rounded-[24px] border border-[var(--color-line)] bg-white/3 p-3">
          <p className="px-2 text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Den här månaden</p>
          <p className="px-2 pt-2 text-base font-semibold capitalize">{formatMonthLabel(monthKey)}</p>
          <div className="mt-3 flex flex-col gap-1">
            {monthSectionItems.map((item) => (
              <Link
                key={item.id}
                href={`${pathname}#${item.id}`}
                onClick={() => setIsSidebarOpen(false)}
                className="rounded-2xl px-3 py-2 text-sm text-[var(--color-muted)] transition hover:bg-white/5 hover:text-[var(--color-ink)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <Link
            href={`${pathname}#new-expense`}
            onClick={() => setIsSidebarOpen(false)}
            className="action-button action-primary mt-4 w-full justify-center rounded-2xl py-2.5"
          >
            <Plus className="h-4 w-4" />
            Ny utgift
          </Link>
        </div>
      ) : null}

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
        <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--color-line)] bg-[rgba(6,10,19,0.88)] px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-accent)]">Budgetkompis</p>
              <p className="mt-1 text-base font-semibold capitalize">{pageTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white/5 text-[var(--color-ink)]"
              aria-label={isSidebarOpen ? "Stäng meny" : "Öppna meny"}
              aria-expanded={isSidebarOpen}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <div
          className={cn(
            "fixed inset-0 z-30 bg-[rgba(3,7,13,0.7)] backdrop-blur-sm transition",
            isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setIsSidebarOpen(false)}
        />

        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[min(86vw,320px)] p-3 transition-transform duration-300",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </div>
      </div>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[312px] lg:p-5">{sidebar}</div>

      <div className="lg:pl-[312px]">
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 pb-28 pt-24 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
