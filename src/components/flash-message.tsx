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
      <div className="rounded-3xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-soft)] px-4 py-3 text-sm font-medium text-[var(--color-danger)] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)] px-4 py-3 text-sm font-medium text-[var(--color-accent)] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
      {notice}
    </div>
  );
}
