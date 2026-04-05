function SkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
}

export function TodayDashboardSkeleton() {
  return (
    <div
      className="mx-auto max-w-lg space-y-4 px-4 pb-8"
      role="status"
      aria-label="ダッシュボードを読み込み中"
    >
      <div className="rounded-2xl bg-slate-900/95 px-5 py-5 shadow-lg">
        <SkeletonBlock className="h-3 w-24 bg-white/20" />
        <SkeletonBlock className="mt-3 h-8 w-40 bg-white/25" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <SkeletonBlock className="h-20 bg-white/15" />
          <SkeletonBlock className="h-20 bg-white/15" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <SkeletonBlock className="mx-auto h-7 w-10" />
            <SkeletonBlock className="mx-auto mt-2 h-3 w-12" />
          </div>
        ))}
      </div>

      <div>
        <SkeletonBlock className="h-6 w-36" />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="h-3 w-1/3" />
                </div>
                <SkeletonBlock className="h-6 w-20 rounded-full" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-10 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GanttPageSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 pb-24"
      role="status"
      aria-label="ガントチャートを読み込み中"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-36" />
          <SkeletonBlock className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-24" />
          <SkeletonBlock className="h-10 w-24" />
          <SkeletonBlock className="h-10 w-28" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-200 bg-slate-50/80">
          <div className="w-64 border-r border-slate-200 px-4 py-3">
            <SkeletonBlock className="h-4 w-20" />
          </div>
          <div className="flex flex-1 gap-2 px-4 py-3">
            {Array.from({ length: 8 }, (_, index) => (
              <SkeletonBlock key={index} className="h-4 flex-1 min-w-0" />
            ))}
          </div>
        </div>

        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex border-b border-slate-100 last:border-b-0">
            <div className="w-64 border-r border-slate-100 px-4 py-4">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="mt-2 h-3 w-24" />
            </div>
            <div className="flex flex-1 items-center px-4 py-4">
              <div className="w-full rounded-xl bg-slate-50 px-3 py-4">
                <SkeletonBlock
                  className={`h-6 ${index % 3 === 0 ? "w-1/4" : index % 3 === 1 ? "w-1/3" : "w-2/5"}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
