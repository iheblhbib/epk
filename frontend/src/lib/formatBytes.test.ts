import { describe, expect, it } from 'vitest'
import { formatBytes } from '@/lib/formatBytes'

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes below 1KB with no decimal', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes with one decimal', () => {
    expect(formatBytes(5_242_880)).toBe('5.0 MB')
  })
})
