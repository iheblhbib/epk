import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CountryChoroplethCard } from '@/features/analytics/components/CountryChoroplethCard'

describe('CountryChoroplethCard', () => {
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
