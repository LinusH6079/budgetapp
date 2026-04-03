"use client";

import { type ReactNode, useState } from "react";
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

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={triggerClassName}>
        {trigger}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(2,6,13,0.72)] p-3 backdrop-blur-md sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Stäng popup"
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={cn(
              "app-panel relative z-10 max-h-[88vh] w-full max-w-xl overflow-y-auto px-5 py-5 sm:px-6",
              dialogClassName,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.03em]">{title}</h3>
                {description ? <p className="muted mt-2">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white/5 text-[var(--color-ink)]"
                aria-label="Stäng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
