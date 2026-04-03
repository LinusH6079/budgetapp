type AppLoadingProps = {
  blocks?: number;
};

export function AppLoading({ blocks = 3 }: AppLoadingProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="app-panel px-5 py-5">
        <div className="skeleton h-4 w-24 rounded-full" />
        <div className="mt-4 skeleton h-9 w-64 rounded-2xl" />
        <div className="mt-6 flex gap-3">
          <div className="skeleton h-10 w-28 rounded-full" />
          <div className="skeleton h-10 w-28 rounded-full" />
          <div className="skeleton h-10 w-28 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: blocks }).map((_, index) => (
          <div key={index} className="app-panel px-5 py-5">
            <div className="skeleton h-5 w-36 rounded-xl" />
            <div className="mt-4 skeleton h-4 w-4/5 rounded-xl" />
            <div className="mt-6 grid gap-3">
              <div className="skeleton h-14 rounded-2xl" />
              <div className="skeleton h-14 rounded-2xl" />
              <div className="skeleton h-12 w-36 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
