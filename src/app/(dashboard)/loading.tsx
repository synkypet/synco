import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-4 w-64 bg-white/5" />
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="bg-anthracite-surface rounded-2xl p-6 h-48 shadow-skeuo-flat flex flex-col gap-4 border-none"
          >
            <div className="flex justify-between items-start">
              <Skeleton className="h-3 w-24 bg-white/5" />
              <Skeleton className="h-8 w-8 rounded-lg bg-white/5" />
            </div>
            <Skeleton className="flex-1 w-full rounded-xl bg-deep-void/50" />
          </div>
        ))}
      </div>

      {/* Large Status Panel Skeleton */}
      <div className="bg-anthracite-surface rounded-2xl p-6 h-64 shadow-skeuo-flat flex flex-col gap-6 border-none">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg bg-white/5" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 bg-white/5" />
            <Skeleton className="h-3 w-16 bg-white/5" />
          </div>
        </div>
        <Skeleton className="h-px w-full bg-white/5" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full bg-white/5" />
              <Skeleton className="h-3 w-full max-w-md bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
