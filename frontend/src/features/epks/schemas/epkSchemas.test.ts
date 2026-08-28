import { describe, expect, it } from 'vitest'
import { artistFormSchema, epkFormSchema } from '@/features/epks/schemas/epkSchemas'

describe('epkFormSchema', () => {
  it('accepts a valid title and artist selection', () => {
    const result = epkFormSchema.safeParse({ title: 'Summer Tour EPK', artist_id: 4 })
    expect(result.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const result = epkFormSchema.safeParse({ title: '', artist_id: 4 })
    expect(result.success).toBe(false)
  })

  it('rejects a missing or unselected artist (sentinel 0)', () => {
    expect(epkFormSchema.safeParse({ title: 'Title', artist_id: 0 }).success).toBe(false)
    expect(epkFormSchema.safeParse({ title: 'Title' }).success).toBe(false)
  })
})

describe('artistFormSchema', () => {
  it('accepts a name-only artist', () => {
    expect(artistFormSchema.safeParse({ name: 'Ada Lovelace' }).success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(artistFormSchema.safeParse({ name: '' }).success).toBe(false)
  })
})
