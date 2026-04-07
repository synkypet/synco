import { Skeleton } from "@/components/ui/skeleton";

export default function RadarLoading() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-white/5" />
          <Skeleton className="h-4 w-96 bg-white/5" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl bg-white/5" />
      </div>

      {/* Toolbar Skeleton */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <Skeleton className="h-11 w-full lg:w-[400px] rounded-xl bg-white/5" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-64 rounded-xl bg-deep-void shadow-skeuo-pressed" />
            <Skeleton className="h-10 w-32 rounded-xl bg-white/5" />
            <Skeleton className="h-10 w-20 rounded-xl bg-deep-void shadow-skeuo-pressed" />
          </div>
        </div>
      </div>

      {/* Product Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div 
            key={i} 
            className="bg-anthracite-surface rounded-2xl p-3 h-[420px] shadow-skeuo-flat flex flex-col gap-3 border-none"
          >
            {/* Image Cave */}
            <Skeleton className="aspect-square w-full rounded-xl bg-deep-void shadow-skeuo-pressed" />
            
            {/* Content */}
            <div className="px-1 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16 bg-white/5" />
                <Skeleton className="h-3 w-12 bg-white/5" />
              </div>
              <Skeleton className="h-4 w-full bg-white/5" />
              
              {/* Price Cave */}
              <Skeleton className="h-12 w-full rounded-xl bg-deep-void/50 shadow-skeuo-pressed" />
              
              {/* Commission */}
              <div className="space-y-1">
                <Skeleton className="h-2 w-12 bg-white/5" />
                <Skeleton className="h-3 w-24 bg-white/5" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-10 flex-1 rounded-xl bg-white/5 shadow-skeuo-flat" />
                <Skeleton className="h-10 w-10 rounded-xl bg-white/5 shadow-skeuo-flat" />
                <Skeleton className="h-10 w-10 rounded-xl bg-white/5 shadow-skeuo-flat" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
