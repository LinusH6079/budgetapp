"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type FormStatusButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function FormStatusButton({
  children,
  pendingLabel,
  className,
  disabled,
}: FormStatusButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={disabled || pending}
      className={cn("action-button", className)}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          <span>{pendingLabel ?? "Sparar..."}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
