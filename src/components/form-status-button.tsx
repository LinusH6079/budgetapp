"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type FormStatusButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
};

export function FormStatusButton({
  children,
  pendingLabel,
  className,
  disabled,
  title,
  "aria-label": ariaLabel,
}: FormStatusButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={disabled || pending}
      className={cn("action-button", className)}
      aria-busy={pending}
      aria-label={ariaLabel}
      title={title}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel !== "" ? <span>{pendingLabel ?? "Sparar..."}</span> : null}
        </>
      ) : (
        children
      )}
    </button>
  );
}
