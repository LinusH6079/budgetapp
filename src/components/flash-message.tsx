"use client";

import { useEffect, useState } from "react";

type FlashMessageProps = {
  notice?: string;
  error?: string;
};

export function FlashMessage({ notice, error }: FlashMessageProps) {
  const [visibleNotice, setVisibleNotice] = useState(notice);
  const [visibleError, setVisibleError] = useState(error);

  useEffect(() => {
    setVisibleNotice(notice);
  }, [notice]);

  useEffect(() => {
    setVisibleError(error);
  }, [error]);

  useEffect(() => {
    if (!visibleNotice && !visibleError) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setVisibleNotice(undefined);
      setVisibleError(undefined);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [visibleNotice, visibleError]);

  if (!visibleNotice && !visibleError) {
    return null;
  }

  if (visibleError) {
    return (
      <div className="sticky top-3 z-30 rounded-2xl border border-[var(--color-danger)]/20 bg-[rgba(48,16,16,0.92)] px-4 py-3 text-sm font-medium text-[var(--color-danger)] backdrop-blur transition-all duration-200">
        {visibleError}
      </div>
    );
  }

  return (
    <div className="sticky top-3 z-30 rounded-2xl border border-[var(--color-accent)]/20 bg-[rgba(24,24,28,0.94)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] backdrop-blur transition-all duration-200">
      {visibleNotice}
    </div>
  );
}
