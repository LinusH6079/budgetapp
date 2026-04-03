"use client";

import { type ReactNode, useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={triggerClassName}>
        {trigger}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.58)] p-3 sm:items-center sm:p-6">
          <button type="button" aria-label="Stäng popup" className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div
            className={cn(
              "app-panel relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto px-4 py-4 sm:px-5",
              dialogClassName,
            )}
          >
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

            <div className="mt-4">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
