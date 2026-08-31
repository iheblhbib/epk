import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/lib/relativeTime'

describe('formatRelativeTime', () => {
  it('formats a few minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinutesAgo, 'en')).toBe('5 minutes ago')
  })

  it('formats a couple hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHoursAgo, 'en')).toBe('2 hours ago')
  })

  it('formats "just now" as seconds ago', () => {
    const justNow = new Date(Date.now() - 5 * 1000)
    expect(formatRelativeTime(justNow, 'en')).toBe('5 seconds ago')
  })

  it('accepts an ISO date string', () => {
    const isoString = new Date(Date.now() - 60 * 1000).toISOString()
    expect(formatRelativeTime(isoString, 'en')).toBe('1 minute ago')
  })

  it('follows the given locale', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHoursAgo, 'fr')).toBe('il y a 2 heures')
  })
})
