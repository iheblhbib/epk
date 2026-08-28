import type { LucideIcon } from 'lucide-react'

export function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <p className="text-xs font-medium tracking-wide uppercase">{label}</p>
      </div>
      <p className="mt-2 font-heading text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
    </div>
  )
}
