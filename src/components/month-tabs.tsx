import Link from "next/link";

import { cn } from "@/lib/utils";

type MonthTabsProps = {
  tabs: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  activeTabId: string;
};

export function MonthTabs({ tabs, activeTabId }: MonthTabsProps) {
  return (
    <div className="app-panel px-3 py-3 sm:px-4">
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition",
              tab.id === activeTabId
                ? "bg-[var(--color-accent-strong)] text-[#09090b]"
                : "bg-[var(--color-elevated)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
