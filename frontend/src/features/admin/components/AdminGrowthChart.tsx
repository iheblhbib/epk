import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { useTranslation } from 'react-i18next'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'bottom' }, tooltip: { intersect: false, mode: 'index' } },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
}

export function AdminGrowthChart({ points }: { points: { date: string; new_users: number; new_workspaces: number }[] }) {
  const { t } = useTranslation()

  const data = {
    labels: points.map((point) => new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: t('admin.dashboard.growth.newUsers'),
        data: points.map((point) => point.new_users),
        borderColor: '#cc1417',
        backgroundColor: 'rgba(204, 20, 23, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: t('admin.dashboard.growth.newWorkspaces'),
        data: points.map((point) => point.new_workspaces),
        borderColor: '#6D5EF9',
        backgroundColor: 'rgba(109, 94, 249, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.growth.title')}</p>
      {points.every((point) => point.new_users === 0 && point.new_workspaces === 0) ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {t('admin.dashboard.growth.empty')}
        </div>
      ) : (
        <div className="h-48">
          <Line data={data} options={OPTIONS} />
        </div>
      )}
    </div>
  )
}
