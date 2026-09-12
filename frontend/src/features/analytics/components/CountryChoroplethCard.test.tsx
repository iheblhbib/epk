import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CountryChoroplethCard } from '@/features/analytics/components/CountryChoroplethCard'

vi.mock('react-chartjs-2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-chartjs-2')>()
  return { ...actual, Chart: vi.fn(() => <canvas />) }
})

describe('CountryChoroplethCard', () => {
  it('gives every chart data point a name, so the tooltip never shows "undefined"', async () => {
    const { Chart } = await import('react-chartjs-2')

    render(
      <CountryChoroplethCard
        rows={[
          { country: 'US', count: 20 },
          { country: 'FR', count: 8 },
        ]}
      />
    )

    const props = vi.mocked(Chart).mock.calls[0][0]
    const points = props.data.datasets[0].data as { name: string; value: number }[]

    expect(points.length).toBeGreaterThan(0)
    for (const point of points) {
      expect(point.name).toEqual(expect.any(String))
      expect(point.name).not.toBe('')
    }
    expect(points.some((point) => point.name === 'United States' && point.value === 20)).toBe(true)
  })

  it('renders the title and a canvas when there is data', () => {
    const { container } = render(
      <CountryChoroplethCard
        rows={[
          { country: 'US', count: 20 },
          { country: 'FR', count: 8 },
        ]}
      />
    )

    expect(screen.getByText('Top countries')).toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('renders the empty state and no canvas when there are no rows', () => {
    const { container } = render(<CountryChoroplethCard rows={[]} />)

    expect(screen.getByText(/No country data yet/)).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('does not throw when a row has an unmapped country code', () => {
    expect(() => render(<CountryChoroplethCard rows={[{ country: 'ZZ', count: 3 }]} />)).not.toThrow()
  })
})
