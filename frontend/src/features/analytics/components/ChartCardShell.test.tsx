import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'

describe('ChartCardShell', () => {
  it('renders the title and its children', () => {
    render(
      <ChartCardShell title="Test Title">
        <p>child content</p>
      </ChartCardShell>
    )

    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
