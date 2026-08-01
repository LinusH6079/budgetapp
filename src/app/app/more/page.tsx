import { ChevronRight, Landmark, ReceiptText, Settings2 } from "lucide-react";

import { PendingLink } from "@/components/pending-link";

const links = [
  {
    href: "/app/loans",
    label: "Lån & finansiering",
    description: "Jämför, aktivera och följ betalplaner",
    icon: Landmark,
  },
  {
    href: "/app/household",
    label: "Hushåll",
    description: "Medlemmar, Swish-historik och backup",
    icon: Settings2,
  },
];

export default function MorePage() {
  return (
    <div className="viewport-page">
      <section className="app-panel px-4 py-4 sm:px-5">
        <p className="eyebrow-label">Ekonomihubb</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Mer</h2>
        <div className="mt-4 grid gap-2">
          {links.map((item) => (
            <PendingLink
              key={item.href}
              href={item.href}
              prefetch
              className="flex items-center gap-3 rounded-[17px] border border-transparent bg-[var(--color-elevated)] px-3.5 py-3 transition hover:border-[var(--color-line)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white/5">
                <item.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[var(--color-muted)]">{item.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
            </PendingLink>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-dashed border-[var(--color-line)] px-4 py-4 text-[var(--color-muted)]">
        <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /><p className="text-xs font-medium">Nästa steg</p></div>
        <p className="mt-1.5 text-[11px] leading-relaxed">Konton, nettoförmögenhet och prognoser kan läggas till här utan att göra huvudnavigationen tyngre.</p>
      </section>
    </div>
  );
}
