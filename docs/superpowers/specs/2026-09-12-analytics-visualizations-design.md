# Analytics Page — Richer Visualizations — Design

## Context

The per-EPK Analytics page (`AnalyticsPage.tsx`) renders five breakdown cards —
Top Referrers, Top Countries, Devices, Top Downloads, Top Private Links — all
through the same generic `BreakdownCard` component: a title, a plain `<ul>` of
rows, and a thin CSS `<div>` progress bar per row. This is the visual the user
wants replaced with "diagrams, maps, or something cool."

Three things worth knowing before the design below:

- **This is a frontend-only change.** `AnalyticsAggregator::summarize()` (backend)
  already returns everything needed: `top_countries` as `[{country, count}]` where
  `country` is a 2-letter ISO-3166 alpha-2 code (`AnalyticsEventLogger::countryFromHeaders()`
  reads it straight from `GEOIP_COUNTRY_CODE`/`CF-IPCountry`, `analytics_events.country`
  is `string(2)`), and the other four breakdowns are already ranked `{label, count}`
  lists. No backend changes, no new endpoints, no API contract changes.
- **No map/geo library exists in this codebase today.** `frontend/package.json`
  has only `chart.js: ^4.5.1` + `react-chartjs-2` for charts (used today by
  `PageViewsChart` and, since the Admin Dashboard pass, `AdminGrowthChart`) — no
  `chartjs-chart-geo`, `react-simple-maps`, `d3-geo`, or any topojson/geo data
  package.
- **`BreakdownCard` is also used by `AdminDashboardPage`** for billing counters
  (`active_by_plan`, `by_status`) — a small, fixed set of named categories, a
  genuinely different shape of problem from "rank up to 8 items with long text
  labels." `BreakdownCard` itself is not touched by this spec; the Admin Dashboard
  keeps using it as-is.
- **Chart.js in this app's test environment renders through a canvas stub.**
  `frontend/src/test/setup.ts` sets `HTMLCanvasElement.prototype.getContext =
  vi.fn(() => ({}))` (jsdom has no real canvas). Existing chart components
  (`PageViewsChart`, `AdminGrowthChart`) already mount and test cleanly against
  this stub because Chart.js's actual `draw()` work is deferred to an animation
  frame that test assertions never wait on — only the synchronous mount path
  (which just calls `getContext` once) runs during a test. `chartjs-chart-geo`'s
  `ChoroplethController` extends the same Chart.js `Controller` base and follows
  the same deferred-draw model, so the existing stub is expected to be sufficient
  without changes.

## Goals

- **Top Countries**: replace the plain list with a static world choropleth map —
  countries shaded by view count, hover for the exact number and country name.
- **Devices**: replace the plain list with a Chart.js doughnut chart (device type
  is a small, fixed category set: desktop/mobile/tablet/other).
- **Top Referrers, Top Downloads, Top Private Links**: replace the plain list with
  a Chart.js horizontal bar chart each (ranked lists with potentially long text
  labels — referrer hostnames, filenames, private-link labels — read better as
  bars than as pie/donut slices).
- Keep the existing 60/30/90-day range selector, EPK selector, loading skeleton,
  and per-card empty states working exactly as they do today.

## Non-goals (explicitly out of scope for this pass)

- **No backend changes.** `top_countries` stays capped at its existing top-8; the
  map highlights the top 8 markets by shading, it does not attempt full
  geographic coverage of every country with any traffic. Confirmed with the user:
  frontend-only is the intended scope, not a reason to uncap the query.
- **No interactive map.** No zoom, pan, or click-to-filter-by-country. A static,
  hover-for-tooltip choropleth only — confirmed with the user in preference to a
  fully interactive map, to avoid introducing a second charting/rendering
  paradigm (e.g. `react-simple-maps`/`d3-geo`) alongside the existing Chart.js
  setup.
- **No changes to the Workspace Dashboard or Admin Dashboard.** Neither currently
  renders these five breakdown shapes (`AdminDashboardPage`'s use of
  `BreakdownCard` is the unrelated billing-counters case above), so there is
  nothing for this spec to touch there.
- **No new i18n keys for empty states.** The existing keys
  (`analytics.breakdowns.noCountryData`, `noDeviceData`, `noReferrerData`,
  `noDownloadData`, `noPrivateLinkData`) are reused as-is by the new components.

## Frontend changes

### New dependencies

```json
"chartjs-chart-geo": "^4.x",
"topojson-client": "^3.x",
"world-atlas": "^2.x"
```

`chartjs-chart-geo` registers `ChoroplethController`, `GeoFeature`,
`ColorScale`, and `ProjectionScale` on top of Chart.js — the standard pairing
for a Chart.js-based choropleth (its own docs use exactly this combination).
`world-atlas`'s `countries-110m.json` (bundled as static JSON, ~100KB) is the
map geometry at 110m resolution — enough detail for a card-sized world map;
`topojson-client`'s `feature()` converts that TopoJSON into the GeoJSON
features `chartjs-chart-geo` consumes.

### `frontend/src/lib/countryCodes.ts` (new)

A static, hand-written lookup — the full ISO-3166 alpha-2 country list rarely
changes, so this is plain reference data, not something worth a runtime
dependency (e.g. `i18n-iso-countries`) just to look up ~250 fixed rows:

```typescript
export interface CountryInfo {
  /** Matches world-atlas / topojson feature `id` (ISO-3166-1 numeric, e.g. "840" for US). */
  numericId: string
  /** Human-readable name for tooltips, e.g. "United States". */
  name: string
}

export const COUNTRY_CODES: Record<string, CountryInfo> = {
  US: { numericId: '840', name: 'United States' },
  FR: { numericId: '250', name: 'France' },
  GB: { numericId: '826', name: 'United Kingdom' },
  // ...full ISO-3166 alpha-2 -> {numericId, name} table, ~250 entries
}

export function lookupCountry(alpha2: string): CountryInfo | null {
  return COUNTRY_CODES[alpha2.toUpperCase()] ?? null
}
```

Any `country` value with no match (malformed data — shouldn't happen given the
backend only ever writes real `GEOIP_COUNTRY_CODE`/`CF-IPCountry` values) is
skipped from the map data rather than throwing, matching how `country` is
already treated as an optional, untrusted field everywhere else it's read.

### `frontend/src/features/analytics/components/ChartCardShell.tsx` (new)

The `rounded-xl border border-border bg-card p-4` + title wrapper currently
duplicated inside `PageViewsChart` gets extracted so the three new chart
components (plus `PageViewsChart`, refactored to use it) share one definition:

```tsx
export function ChartCardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  )
}
```

### `frontend/src/features/analytics/components/CountryChoroplethCard.tsx` (new)

```tsx
import {
  CategoryScale,
  Chart as ChartJS,
  Tooltip,
} from 'chart.js'
import {
  ChoroplethController,
  ColorScale,
  GeoFeature,
  ProjectionScale,
  topojson,
} from 'chartjs-chart-geo'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Chart } from 'react-chartjs-2'
import worldAtlas from 'world-atlas/countries-110m.json'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'
import { lookupCountry } from '@/lib/countryCodes'

ChartJS.register(ChoroplethController, GeoFeature, ColorScale, ProjectionScale, CategoryScale, Tooltip)

const COUNTRIES = topojson.feature(worldAtlas as any, (worldAtlas as any).objects.countries).features

export function CountryChoroplethCard({ rows }: { rows: { country: string; count: number }[] }) {
  const { t } = useTranslation()

  const { data, max } = useMemo(() => {
    const countByNumericId = new Map<string, { count: number; name: string }>()
    for (const row of rows) {
      const info = lookupCountry(row.country)
      if (info) countByNumericId.set(info.numericId, { count: row.count, name: info.name })
    }
    const values = COUNTRIES.map((feature: any) => {
      const match = countByNumericId.get(feature.id)
      return { feature, value: match?.count ?? 0, name: match?.name ?? feature.properties.name }
    })
    return { data: values, max: Math.max(1, ...rows.map((row) => row.count)) }
  }, [rows])

  return (
    <ChartCardShell title={t('analytics.breakdowns.topCountries')}>
      {rows.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          {t('analytics.breakdowns.noCountryData')}
        </div>
      ) : (
        <div className="h-56">
          <Chart
            type="choropleth"
            data={{
              labels: data.map((d) => d.name),
              datasets: [{ data: data.map((d) => ({ feature: d.feature, value: d.value })) }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              showOutline: true,
              showGraticule: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx: any) => `${ctx.raw.name}: ${ctx.raw.value.toLocaleString()}`,
                  },
                },
              },
              scales: {
                projection: { axis: 'x', projection: 'equalEarth' },
                color: {
                  axis: 'x',
                  quantize: 5,
                  legend: { position: 'bottom-right' },
                  interpolate: (v: number) => `rgba(109, 94, 249, ${0.15 + v * 0.75})`,
                  min: 0,
                  max,
                },
              },
            }}
          />
        </div>
      )}
    </ChartCardShell>
  )
}
```

(Color scale uses the app's existing primary indigo-violet token — `#6D5EF9`,
already used by `AdminGrowthChart` — as a single-hue sequential ramp, rather
than Chart.js-geo's default multi-hue scale, for visual consistency with the
rest of the app and to avoid a diverging red/green palette.)

### `frontend/src/features/analytics/components/DeviceDonutChart.tsx` (new)

```tsx
import { ArcElement, Chart as ChartJS, Tooltip, type ChartOptions } from 'chart.js'
import { useTranslation } from 'react-i18next'
import { Doughnut } from 'react-chartjs-2'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'

ChartJS.register(ArcElement, Tooltip)

const COLORS = ['#6D5EF9', '#10b981', '#f59e0b', '#94a3b8']

const OPTIONS: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
}

export function DeviceDonutChart({ rows }: { rows: { device_type: string; count: number }[] }) {
  const { t } = useTranslation()

  return (
    <ChartCardShell title={t('analytics.breakdowns.devices')}>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {t('analytics.breakdowns.noDeviceData')}
        </div>
      ) : (
        <div className="h-48">
          <Doughnut
            data={{
              labels: rows.map((row) => row.device_type),
              datasets: [{ data: rows.map((row) => row.count), backgroundColor: COLORS, borderWidth: 0 }],
            }}
            options={OPTIONS}
          />
        </div>
      )}
    </ChartCardShell>
  )
}
```

`ArcElement`/`Tooltip` registration is additive and distinct from
`PageViewsChart`'s/`AdminGrowthChart`'s line-chart registrations (`LineElement`,
`PointElement`, etc.) — no cross-chart interference risk of the kind found
during the Admin Dashboard review (that was `Legend`, a plugin, not an element
type; `ArcElement` only affects doughnut/pie datasets).

### `frontend/src/features/analytics/components/RankingBarChart.tsx` (new)

One reusable component for the three ranked-list cards:

```tsx
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const OPTIONS: ChartOptions<'bar'> = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 } },
    y: { grid: { display: false } },
  },
}

export function RankingBarChart({
  title,
  emptyLabel,
  rows,
}: {
  title: string
  emptyLabel: string
  rows: { label: string; count: number }[]
}) {
  return (
    <ChartCardShell title={title}>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div style={{ height: Math.max(96, rows.length * 32) }}>
          <Bar
            data={{
              labels: rows.map((row) => row.label),
              datasets: [{ data: rows.map((row) => row.count), backgroundColor: '#6D5EF9', borderRadius: 4 }],
            }}
            options={OPTIONS}
          />
        </div>
      )}
    </ChartCardShell>
  )
}
```

(Height scales with row count so long labels on the y-axis stay readable
instead of a fixed box squeezing 8 bars — the existing `BreakdownCard` had no
such constraint since CSS rows just stack.)

### `AnalyticsPage.tsx` — swap the five `BreakdownCard`s

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <RankingBarChart
    title={t('analytics.breakdowns.topReferrers')}
    emptyLabel={t('analytics.breakdowns.noReferrerData')}
    rows={analytics.top_referrers.map((row) => ({ label: row.referrer, count: row.count }))}
  />
  <CountryChoroplethCard rows={analytics.top_countries} />
  <DeviceDonutChart rows={analytics.devices} />
  <RankingBarChart
    title={t('analytics.breakdowns.topDownloads')}
    emptyLabel={t('analytics.breakdowns.noDownloadData')}
    rows={analytics.top_downloads.map((row) => ({ label: row.filename, count: row.count }))}
  />
  <RankingBarChart
    title={t('analytics.breakdowns.topPrivateLinks')}
    emptyLabel={t('analytics.breakdowns.noPrivateLinkData')}
    rows={analytics.top_private_links.map((row) => ({ label: row.label, count: row.count }))}
  />
</div>
```

`BreakdownCard.tsx` and its import in `AnalyticsPage.tsx` are removed once
nothing there references it — `AdminDashboardPage.tsx`'s own import is
untouched.

### `PageViewsChart.tsx` — adopt `ChartCardShell`

Minor refactor: replace its own inline `<div className="rounded-xl...">` +
`<p className="...">` wrapper with `<ChartCardShell title={...}>`, no behavior
change. Included here because leaving it as the only chart component with a
duplicated wrapper, right after introducing `ChartCardShell` for the other
four, would be an inconsistency in the same file this spec already touches.

## Testing plan

No backend tests needed (no backend changes).

**Frontend (Vitest + RTL)**, new test files:

- `countryCodes.test.ts`: `lookupCountry` resolves known codes (`US`, `FR`) to
  the right `numericId`/`name`; returns `null` for an unknown/malformed code;
  case-insensitive (`us` resolves the same as `US`).
- `CountryChoroplethCard.test.tsx`: renders without throwing given mock rows
  (validates the canvas-stub assumption above holds for `chartjs-chart-geo`,
  same pattern as existing chart component tests); renders the
  `noCountryData` empty state when `rows` is empty; a row with an unmapped
  country code doesn't crash the component (mapping returns `null`, row is
  skipped from `data`, not thrown from `.get()`).
- `DeviceDonutChart.test.tsx`: renders without throwing given mock rows;
  renders the `noDeviceData` empty state when `rows` is empty.
- `RankingBarChart.test.tsx`: renders without throwing given mock rows in all
  three call shapes (referrer/download/private-link label fields already
  normalized to `{label, count}` by the caller); renders the passed
  `emptyLabel` when `rows` is empty.
- `AnalyticsPage.test.tsx` (new — none exists today): extends the page's
  existing MSW-mocked analytics fixture; asserts all five new components
  render (by testid or accessible role, not by asserting on canvas pixel
  output, which the stub can't produce) once loading resolves.

## Open items for the implementation plan

- The full ~250-row `COUNTRY_CODES` table (only 3 entries shown above as
  illustration) needs to be written out in full — a standard, publicly known,
  static ISO-3166 alpha-2 → numeric-id + English-name mapping.
- Confirm `chartjs-chart-geo`'s current published version range against
  `chart.js@^4.5.1` (peer dependency compatibility) at implementation time.
- Exact grid placement is unchanged (`lg:grid-cols-4`, 5 cards) — no new layout
  decision needed here, unlike the Admin Dashboard spec's open layout question.
