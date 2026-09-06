import { describe, expect, it } from 'vitest'
import { clearDeviceOverride, isInherited, normalizeResponsive, withDeviceOverride } from '@/lib/responsiveValue'

describe('normalizeResponsive', () => {
  it('treats a plain legacy value as desktop-only, inheriting to tablet and mobile', () => {
    expect(normalizeResponsive('large', 'large')).toEqual({ desktop: 'large', tablet: 'large', mobile: 'large' })
  })

  it('treats a missing value as the given fallback', () => {
    expect(normalizeResponsive(undefined, 'large')).toEqual({ desktop: 'large', tablet: 'large', mobile: 'large' })
  })

  it('lets tablet inherit desktop when tablet is unset', () => {
    expect(normalizeResponsive({ desktop: 'large' }, 'large')).toEqual({
      desktop: 'large',
      tablet: 'large',
      mobile: 'large',
    })
  })

  it('lets mobile inherit tablet (not desktop) when only mobile is unset', () => {
    expect(normalizeResponsive({ desktop: 'large', tablet: 'medium' }, 'large')).toEqual({
      desktop: 'large',
      tablet: 'medium',
      mobile: 'medium',
    })
  })

  it('keeps every explicit value when all three are set', () => {
    expect(normalizeResponsive({ desktop: 'large', tablet: 'medium', mobile: 'small' }, 'large')).toEqual({
      desktop: 'large',
      tablet: 'medium',
      mobile: 'small',
    })
  })

  it('treats an explicit null for tablet the same as an absent tablet key', () => {
    expect(normalizeResponsive({ desktop: 'large', tablet: null, mobile: 'small' }, 'large')).toEqual({
      desktop: 'large',
      tablet: 'large',
      mobile: 'small',
    })
  })
})

describe('isInherited', () => {
  it('is always false for desktop', () => {
    expect(isInherited(undefined, 'desktop')).toBe(false)
    expect(isInherited({ desktop: 'large' }, 'desktop')).toBe(false)
  })

  it('is true for tablet/mobile when the value is a legacy plain string', () => {
    expect(isInherited('large', 'tablet')).toBe(true)
    expect(isInherited('large', 'mobile')).toBe(true)
  })

  it('is true for tablet when the responsive object has no tablet key', () => {
    expect(isInherited({ desktop: 'large' }, 'tablet')).toBe(true)
  })

  it('is false for tablet when the responsive object has an explicit tablet value', () => {
    expect(isInherited({ desktop: 'large', tablet: 'medium' }, 'tablet')).toBe(false)
  })

  it('is true for mobile when only desktop and tablet are set', () => {
    expect(isInherited({ desktop: 'large', tablet: 'medium' }, 'mobile')).toBe(true)
  })
})

describe('withDeviceOverride', () => {
  it('sets tablet on a legacy plain value without materializing mobile', () => {
    expect(withDeviceOverride('large', 'tablet', 'medium', 'large')).toEqual({ desktop: 'large', tablet: 'medium' })
  })
  it('leaves other devices still inheriting when editing desktop', () => {
    expect(withDeviceOverride({ desktop: 'large' }, 'desktop', 'small', 'large')).toEqual({ desktop: 'small' })
  })
  it('preserves an existing tablet override when editing mobile', () => {
    expect(withDeviceOverride({ desktop: 'large', tablet: 'medium' }, 'mobile', 'small', 'large')).toEqual({
      desktop: 'large',
      tablet: 'medium',
      mobile: 'small',
    })
  })
  it('seeds desktop from the fallback when nothing is set yet', () => {
    expect(withDeviceOverride(undefined, 'tablet', 'small', 'large')).toEqual({ desktop: 'large', tablet: 'small' })
  })
})

describe('clearDeviceOverride', () => {
  it('removes an explicit tablet override, leaving desktop untouched', () => {
    expect(clearDeviceOverride({ desktop: 'large', tablet: 'medium' }, 'tablet')).toEqual({ desktop: 'large' })
  })

  it('removes mobile while an existing tablet override is preserved', () => {
    expect(clearDeviceOverride({ desktop: 'large', tablet: 'medium', mobile: 'small' }, 'mobile')).toEqual({
      desktop: 'large',
      tablet: 'medium',
    })
  })

  it('is a no-op on a legacy plain value -- nothing to clear', () => {
    expect(clearDeviceOverride('large', 'tablet')).toBe('large')
  })

  it('is a no-op on an undefined value -- nothing to clear', () => {
    expect(clearDeviceOverride(undefined, 'tablet')).toBeUndefined()
  })
})
