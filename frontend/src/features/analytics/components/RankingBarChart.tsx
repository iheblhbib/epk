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
              datasets: [{ data: rows.map((row) => row.count), backgroundColor: '#cc1417', borderRadius: 4 }],
            }}
            options={OPTIONS}
          />
        </div>
      )}
    </ChartCardShell>
  )
}
