import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES, lookupCountry } from '@/lib/countryCodes'

describe('lookupCountry', () => {
  it('resolves a known alpha-2 code to its numeric id and name', () => {
    expect(lookupCountry('US')).toEqual({ numericId: '840', name: 'United States' })
  })

  it('resolves a second known code', () => {
    expect(lookupCountry('FR')).toEqual({ numericId: '250', name: 'France' })
  })

  it('is case-insensitive', () => {
    expect(lookupCountry('us')).toEqual({ numericId: '840', name: 'United States' })
  })

  it('returns null for an unknown or malformed code', () => {
    expect(lookupCountry('ZZ')).toBeNull()
    expect(lookupCountry('')).toBeNull()
  })

  it('gives every entry a 3-digit zero-padded numeric id', () => {
    for (const info of Object.values(COUNTRY_CODES)) {
      expect(info.numericId).toMatch(/^\d{3}$/)
    }
  })
})
