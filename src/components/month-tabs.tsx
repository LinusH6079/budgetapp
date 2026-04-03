"use client";

import { ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

type MonthTabsProps = {
  tabs: Array<{
    id: string;
    label: string;
    content: ReactNode;
  }>;
  defaultTabId?: string;
};

export function MonthTabs({ tabs, defaultTabId }: MonthTabsProps) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId ?? tabs[0]?.id ?? "");

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  if (!activeTab) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="app-panel px-3 py-3 sm:px-4">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition",
                tab.id === activeTab.id
                  ? "bg-[var(--color-accent-strong)] text-[#09090b]"
                  : "bg-[var(--color-elevated)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>{activeTab.content}</div>
    </section>
  );
}
