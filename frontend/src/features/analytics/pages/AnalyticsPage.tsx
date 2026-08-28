import { BarChart3, Download, Eye, Music2, Users, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BreakdownCard } from '@/features/analytics/components/BreakdownCard'
import { PageViewsChart } from '@/features/analytics/components/PageViewsChart'
import { StatTile } from '@/features/analytics/components/StatTile'
import { useEpkAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { useEpks } from '@/features/epks/hooks/useEpks'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'

const RANGE_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function AnalyticsPage() {
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: epks, isLoading: epksLoading } = useEpks(currentWorkspace?.id)
  const [selectedEpkId, setSelectedEpkId] = useState<number | null>(null)
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]['days']>(30)

  const effectiveEpkId = selectedEpkId ?? epks?.[0]?.id ?? undefined

  const range = useMemo(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - (rangeDays - 1))
    return { from: toDateString(from), to: toDateString(to) }
  }, [rangeDays])

  const { data: analytics, isLoading: analyticsLoading } = useEpkAnalytics(effectiveEpkId, range)

  if (workspaceLoading || epksLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No workspace yet"
        description="Create a workspace from the dashboard before viewing analytics."
      />
    )
  }

  if (!epks || epks.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Analytics</h1>
        <EmptyState
          icon={BarChart3}
          title="No EPKs yet"
          description="Create and publish an EPK to start seeing page views, downloads, and plays here."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Analytics</h1>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={Object.fromEntries(epks.map((epk) => [String(epk.id), epk.title]))}
            value={String(effectiveEpkId ?? '')}
            onValueChange={(value) => setSelectedEpkId(Number(value))}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {epks.map((epk) => (
                <SelectItem key={epk.id} value={String(epk.id)}>
                  {epk.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.days}
                type="button"
                size="sm"
                variant={rangeDays === option.days ? 'secondary' : 'ghost'}
                onClick={() => setRangeDays(option.days)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {analyticsLoading || !analytics ? (
        <CardGridSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile icon={Eye} label="Page views" value={analytics.totals.page_views} />
            <StatTile icon={Users} label="Unique visitors" value={analytics.totals.unique_visitors} />
            <StatTile icon={Download} label="Downloads" value={analytics.totals.downloads} />
            <StatTile icon={Music2} label="Audio plays" value={analytics.totals.audio_plays} />
            <StatTile icon={Video} label="Video plays" value={analytics.totals.video_plays} />
          </div>

          <PageViewsChart points={analytics.daily_page_views} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BreakdownCard
              title="Top referrers"
              emptyLabel="No referrer data yet."
              rows={analytics.top_referrers.map((row) => ({ label: row.referrer, count: row.count }))}
            />
            <BreakdownCard
              title="Top countries"
              emptyLabel="No country data yet — this needs GEOIP_COUNTRY_CODE (Apache mod_geoip2) or a CF-IPCountry header from your host/CDN."
              rows={analytics.top_countries.map((row) => ({ label: row.country, count: row.count }))}
            />
            <BreakdownCard
              title="Devices"
              emptyLabel="No device data yet."
              rows={analytics.devices.map((row) => ({ label: row.device_type, count: row.count }))}
            />
            <BreakdownCard
              title="Top downloads"
              emptyLabel="No downloads yet."
              rows={analytics.top_downloads.map((row) => ({ label: row.filename, count: row.count }))}
            />
            <BreakdownCard
              title="Top private links"
              emptyLabel="No private-link traffic yet."
              rows={analytics.top_private_links.map((row) => ({ label: row.label, count: row.count }))}
            />
          </div>
        </>
      )}
    </div>
  )
}
