import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { AnalyticsDailyPoint } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: { intersect: false, mode: 'index' },
  },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
}

export function PageViewsChart({ points }: { points: AnalyticsDailyPoint[] }) {
  const data = {
    labels: points.map((point) =>
      new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: 'Page views',
        data: points.map((point) => point.count),
        borderColor: '#6d5ef9',
        backgroundColor: 'rgba(109, 94, 249, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Page views</p>
      {points.every((point) => point.count === 0) ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No page views in this range yet.
        </div>
      ) : (
        <div className="h-48">
          <Line data={data} options={OPTIONS} />
        </div>
      )}
    </div>
  )
}
