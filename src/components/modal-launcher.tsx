"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ModalLauncherProps = {
  title: string;
  description?: string;
  trigger: ReactNode;
  triggerClassName?: string;
  dialogClassName?: string;
  children: ReactNode;
};

export function ModalLauncher({
  title,
  description,
  trigger,
  triggerClassName,
  dialogClassName,
  children,
}: ModalLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, searchParams]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn("touch-manipulation", triggerClassName)}
      >
        {trigger}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.62)] p-3 sm:items-center sm:p-6">
          <button type="button" aria-label="Stäng" className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div
            className={cn(
              "app-panel relative z-10 w-full max-w-lg overflow-hidden rounded-[24px] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:px-5",
              dialogClassName,
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/10 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.03em]">{title}</h3>
                {description ? <p className="muted mt-1">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-elevated)] text-[var(--color-ink)]"
                aria-label="Stäng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[72vh] overflow-y-auto pr-1">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
