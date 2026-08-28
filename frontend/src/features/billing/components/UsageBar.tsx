import { cn } from '@/lib/utils'

export function UsageBar({
  label,
  used,
  limit,
  formatValue = (value) => value.toLocaleString(),
}: {
  label: string
  used: number
  limit: number | null
  formatValue?: (value: number) => string
}) {
  const percent = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  const isNearLimit = limit !== null && percent >= 90

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatValue(used)} {limit === null ? '' : `/ ${formatValue(limit)}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {limit !== null && (
          <div
            className={cn('h-full rounded-full bg-primary transition-all', isNearLimit && 'bg-destructive')}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  )
}
