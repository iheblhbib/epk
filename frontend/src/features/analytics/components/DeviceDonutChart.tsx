import { ArcElement, Chart as ChartJS, Tooltip, type ChartOptions } from 'chart.js'
import { useTranslation } from 'react-i18next'
import { Doughnut } from 'react-chartjs-2'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'

ChartJS.register(ArcElement, Tooltip)

const COLORS = ['#cc1417', '#10b981', '#f59e0b', '#94a3b8']

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
