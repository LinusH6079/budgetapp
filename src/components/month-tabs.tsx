import { PendingLink } from "@/components/pending-link";
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
    <div className="rounded-[18px] bg-[var(--color-elevated)] p-1">
      <div className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => (
          <PendingLink
            key={tab.id}
            href={tab.href}
            prefetch
            className={cn(
              "rounded-[14px] px-3 py-2 text-center text-[13px] font-medium transition",
              tab.id === activeTabId
                ? "bg-[var(--color-panel)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                : "text-[var(--color-muted)]",
            )}
          >
            {tab.label}
          </PendingLink>
        ))}
      </div>
    </div>
  );
}
