export function ChartSkeleton() {
  return (
    <div className="h-[340px] rounded-lg bg-surface-card border border-border-default animate-pulse p-4">
      <div className="h-4 bg-surface-hover rounded w-1/3 mb-4" />
      <div className="h-[260px] bg-surface-hover rounded" />
    </div>
  );
}
