import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700",
        "bg-size-200 bg-pos-0 animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

interface ReceiptSkeletonProps {
  count?: number;
}

export function ReceiptSkeleton({ count = 3 }: ReceiptSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0 mb-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex sm:flex-col items-start sm:items-end sm:text-right space-x-2 sm:space-x-0 space-y-0 sm:space-y-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ShiftReportSkeletonProps {
  count?: number;
}

export function ShiftReportSkeleton({ count = 4 }: ShiftReportSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0 mb-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-3">
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-18" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-4 w-14" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DashboardSkeletonProps {
  type: 'kpi' | 'chart' | 'list';
}

export function DashboardSkeleton({ type }: DashboardSkeletonProps) {
  if (type === 'kpi') {
    return (
      <div className="p-6 border rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className="p-6 border rounded-lg space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-end space-x-1">
              <Skeleton className={`w-12 h-${8 + (i % 4) * 4}`} />
              <Skeleton className={`w-12 h-${6 + (i % 3) * 3}`} />
              <Skeleton className={`w-12 h-${10 + (i % 5) * 2}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border rounded">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-2 w-2 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}