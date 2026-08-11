"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PendingLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PendingLink({ children, className, onClick, ...props }: PendingLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname}?${searchParams.toString()}`, [pathname, searchParams]);
  const [pendingRouteKey, setPendingRouteKey] = useState<string | null>(null);
  const isPending = pendingRouteKey === routeKey;

  useEffect(() => {
    if (!isPending) {
      return;
    }

    const timeout = window.setTimeout(() => setPendingRouteKey(null), 15_000);
    return () => window.clearTimeout(timeout);
  }, [isPending]);

  return (
    <Link
      {...props}
      className={cn("pending-link touch-manipulation", className)}
      data-pending={isPending || undefined}
      aria-busy={isPending || undefined}
      onClick={(event) => {
        onClick?.(event);

        if (isPlainLeftClick(event)) {
          setPendingRouteKey(routeKey);
          window.dispatchEvent(new CustomEvent("app:navigation-start"));
        }
      }}
    >
      {children}
    </Link>
  );
}
