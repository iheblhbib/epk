import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { createArtistFormSchema } from '@/features/artists/schemas/artistSchemas'

const artistFormSchema = createArtistFormSchema(i18n.t)

describe('artistFormSchema', () => {
  it('accepts a minimal artist with just a name', () => {
    expect(artistFormSchema.safeParse({ name: 'Nova Ray' }).success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(artistFormSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('accepts empty strings for every optional field', () => {
    const result = artistFormSchema.safeParse({
      name: 'Nova Ray',
      stage_name: '',
      genre: '',
      country: '',
      city: '',
      short_bio: '',
      website: '',
      booking_email: '',
      press_email: '',
      management_email: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed website URL', () => {
    expect(artistFormSchema.safeParse({ name: 'Nova Ray', website: 'not-a-url' }).success).toBe(false)
  })

  it('accepts a valid website URL', () => {
    expect(artistFormSchema.safeParse({ name: 'Nova Ray', website: 'https://novaray.fm' }).success).toBe(true)
  })

  it('rejects a malformed contact email', () => {
    expect(artistFormSchema.safeParse({ name: 'Nova Ray', booking_email: 'nope' }).success).toBe(false)
  })

  it('rejects a short bio over the 1000-char limit the backend enforces', () => {
    expect(artistFormSchema.safeParse({ name: 'Nova Ray', short_bio: 'a'.repeat(1001) }).success).toBe(false)
  })
})
