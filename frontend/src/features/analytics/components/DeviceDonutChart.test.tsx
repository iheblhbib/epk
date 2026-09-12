import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeviceDonutChart } from '@/features/analytics/components/DeviceDonutChart'

describe('DeviceDonutChart', () => {
  it('renders the title and a canvas when there is data', () => {
    const { container } = render(
      <DeviceDonutChart
        rows={[
          { device_type: 'desktop', count: 10 },
          { device_type: 'mobile', count: 5 },
        ]}
      />
    )

    expect(screen.getByText('Devices')).toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('renders the empty state and no canvas when there are no rows', () => {
    const { container } = render(<DeviceDonutChart rows={[]} />)

    expect(screen.getByText('No device data yet.')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })
})
