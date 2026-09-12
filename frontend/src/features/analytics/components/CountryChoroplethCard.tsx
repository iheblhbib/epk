import { CategoryScale, Chart as ChartJS, Tooltip } from 'chart.js'
import { ChoroplethController, ColorScale, GeoFeature, ProjectionScale, topojson } from 'chartjs-chart-geo'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Chart } from 'react-chartjs-2'
import worldAtlas from 'world-atlas/countries-110m.json'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'
import { lookupCountry } from '@/lib/countryCodes'

ChartJS.register(ChoroplethController, GeoFeature, ColorScale, ProjectionScale, CategoryScale, Tooltip)

// world-atlas ships raw TopoJSON; chartjs-chart-geo's GeoFeature datasets need
// GeoJSON features, so this converts once at module load (the atlas itself
// never changes at runtime).
const COUNTRIES = (topojson.feature(worldAtlas as any, (worldAtlas as any).objects.countries) as any).features as {
  id: string
  properties: { name: string }
}[]

export function CountryChoroplethCard({ rows }: { rows: { country: string; count: number }[] }) {
  const { t } = useTranslation()

  const { entries, max } = useMemo(() => {
    const countByNumericId = new Map<string, { count: number; name: string }>()
    for (const row of rows) {
      const info = lookupCountry(row.country)
      if (info) countByNumericId.set(info.numericId, { count: row.count, name: info.name })
    }

    const values = COUNTRIES.map((feature) => {
      const match = countByNumericId.get(feature.id)
      return { feature, value: match?.count ?? 0, name: match?.name ?? feature.properties.name }
    })

    return { entries: values, max: Math.max(1, ...rows.map((row) => row.count)) }
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
              labels: entries.map((entry) => entry.name),
              datasets: [{ data: entries.map((entry) => ({ feature: entry.feature, value: entry.value, name: entry.name })) }],
            }}
            options={
              {
                responsive: true,
                maintainAspectRatio: false,
                showOutline: true,
                showGraticule: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx: any) => `${ctx.raw.name}: ${Number(ctx.raw.value).toLocaleString()}`,
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
              } as any
            }
          />
        </div>
      )}
    </ChartCardShell>
  )
}
