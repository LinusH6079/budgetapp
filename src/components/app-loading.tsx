type AppLoadingProps = {
  blocks?: number;
};

export function AppLoading({ blocks = 3 }: AppLoadingProps) {
  return (
    <div className="viewport-page" role="status" aria-live="polite" aria-label="Laddar innehåll">
      <div className="flex items-center gap-2 px-1 text-xs font-medium text-[var(--color-muted)]">
        <span className="spinner" aria-hidden="true" />
        <span>Laddar innehåll...</span>
      </div>

      <div className="app-panel px-4 py-4 sm:px-5">
        <div className="skeleton h-4 w-24 rounded-full" />
        <div className="mt-3 skeleton h-9 w-52 rounded-2xl" />
        <div className="mt-5 flex gap-3">
          <div className="skeleton h-10 w-28 rounded-full" />
          <div className="skeleton h-10 w-28 rounded-full" />
          <div className="skeleton h-10 w-28 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: blocks }).map((_, index) => (
          <div key={index} className="app-panel px-4 py-4 sm:px-5">
            <div className="skeleton h-5 w-36 rounded-xl" />
            <div className="mt-3 skeleton h-4 w-4/5 rounded-xl" />
            <div className="mt-5 grid gap-2.5">
              <div className="skeleton h-12 rounded-2xl" />
              <div className="skeleton h-12 rounded-2xl" />
              <div className="skeleton h-10 w-36 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
