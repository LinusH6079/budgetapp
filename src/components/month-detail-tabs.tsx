"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type MonthDetailTabsProps = {
  initialActiveTabId: string;
  tabs: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  panels: Array<{
    id: string;
    content: ReactNode;
  }>;
};

function tabFromLocation(fallback: string, validTabs: Set<string>) {
  const tab = new URLSearchParams(window.location.search).get("tab") ?? "summary";
  return validTabs.has(tab) ? tab : fallback;
}

export function MonthDetailTabs({
  initialActiveTabId,
  tabs,
  panels,
}: MonthDetailTabsProps) {
  const [activeTabId, setActiveTabId] = useState(initialActiveTabId);
  const validTabs = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);

  useEffect(() => {
    const handleHistoryChange = () => {
      setActiveTabId(tabFromLocation(initialActiveTabId, validTabs));
    };

    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, [initialActiveTabId, validTabs]);

  const selectTab = (tab: (typeof tabs)[number]) => {
    if (tab.id === activeTabId) {
      return;
    }

    setActiveTabId(tab.id);
    window.history.pushState(window.history.state, "", tab.href);
  };

  return (
    <>
      <div
        className="rounded-[18px] bg-[var(--color-elevated)] p-1"
        role="tablist"
        aria-label="Månadsinnehåll"
      >
        <div className="grid grid-cols-4 gap-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(tab)}
                className={cn(
                  "touch-feedback rounded-[14px] px-2 py-2 text-center text-[13px] font-medium transition-[background-color,color,transform]",
                  isActive
                    ? "bg-[var(--color-panel)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-[var(--color-muted)]",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {panels.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          className={cn(
            panel.id === activeTabId ? "tab-panel-enter block" : "hidden",
          )}
        >
          {panel.content}
        </div>
      ))}
    </>
  );
}
