export function PostSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
      <div className="flex gap-4">
        <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0" />

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-4 bg-muted rounded w-16" />
            <div className="h-4 bg-muted rounded w-8" />
          </div>

          <div className="space-y-2 mb-4">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>

          <div className="flex items-center gap-6">
            <div className="h-8 bg-muted rounded w-16" />
            <div className="h-8 bg-muted rounded w-16" />
            <div className="h-8 bg-muted rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-border rounded-xl p-6 animate-pulse">
      <div className="h-6 bg-muted rounded w-32 mb-4" />

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-muted rounded w-20 mb-1" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
            <div className="h-8 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
