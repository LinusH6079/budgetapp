type WarningBannerProps = {
  warnings: string[];
};

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="app-panel border-[var(--color-warning)]/20 bg-[var(--color-warning-soft)] px-5 py-5 sm:px-6">
      <h2 className="section-title text-[var(--color-warning)]">Varningar och status</h2>
      <div className="mt-4 grid gap-3">
        {warnings.map((warning) => (
          <p key={warning} className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-medium text-[var(--color-warning)]">
            {warning}
          </p>
        ))}
      </div>
    </section>
  );
}
