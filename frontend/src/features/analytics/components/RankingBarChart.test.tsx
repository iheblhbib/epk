import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RankingBarChart } from '@/features/analytics/components/RankingBarChart'

describe('RankingBarChart', () => {
  it('renders the title and a canvas when there is data', () => {
    const { container } = render(
      <RankingBarChart
        title="Top referrers"
        emptyLabel="No referrer data yet."
        rows={[
          { label: 'google.com', count: 12 },
          { label: 'twitter.com', count: 4 },
        ]}
      />
    )

    expect(screen.getByText('Top referrers')).toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('renders the passed empty label and no canvas when there are no rows', () => {
    const { container } = render(<RankingBarChart title="Top downloads" emptyLabel="No downloads yet." rows={[]} />)

    expect(screen.getByText('No downloads yet.')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })
})
