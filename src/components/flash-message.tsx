type FlashMessageProps = {
  notice?: string;
  error?: string;
};

export function FlashMessage({ notice, error }: FlashMessageProps) {
  if (!notice && !error) {
    return null;
  }

  if (error) {
    return (
      <div className="sticky top-3 z-30 rounded-2xl border border-[var(--color-danger)]/20 bg-[rgba(48,16,16,0.92)] px-4 py-3 text-sm font-medium text-[var(--color-danger)] backdrop-blur">
        {error}
      </div>
    );
  }

  return (
    <div className="sticky top-3 z-30 rounded-2xl border border-[var(--color-accent)]/20 bg-[rgba(24,24,28,0.94)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] backdrop-blur">
      {notice}
    </div>
  );
}
