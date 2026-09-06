import type { ResponsiveValue } from '@/types'

export type DeviceWidth = 'desktop' | 'tablet' | 'mobile'

/** The fully-resolved shape normalizeResponsive() always returns -- unlike
 * ResponsiveValue<T> itself, none of these three keys can be null/missing. */
export interface ResolvedResponsiveValue<T> {
  desktop: T
  tablet: T
  mobile: T
}

function asResponsiveObject<T>(raw: T | ResponsiveValue<T> | undefined): ResponsiveValue<T> | undefined {
  return raw !== null && typeof raw === 'object' && 'desktop' in raw ? (raw as ResponsiveValue<T>) : undefined
}

/**
 * Normalizes a legacy plain value OR an already-responsive object into the
 * full { desktop, tablet, mobile } shape, applying the same
 * mobile-inherits-tablet-inherits-desktop rule as the backend resolver
 * (PublicSectionConfigResolver::resolveResponsive()) -- both must agree,
 * since they resolve the same stored JSON.
 */
export function normalizeResponsive<T>(
  raw: T | ResponsiveValue<T> | undefined,
  fallback: T
): ResolvedResponsiveValue<T> {
  const asObject = asResponsiveObject(raw)
  const value: ResponsiveValue<T> = asObject ?? { desktop: (raw as T | undefined) ?? fallback }

  const desktop = value.desktop ?? fallback
  const tablet = value.tablet ?? desktop
  const mobile = value.mobile ?? tablet

  return { desktop, tablet, mobile }
}

/**
 * True when this device's value is not an explicit override -- i.e. it's
 * showing a value inherited from the next-larger breakpoint (tablet inherits
 * desktop; mobile inherits tablet). Always false for desktop, since desktop
 * has no larger breakpoint to inherit from. Drives the settings panel's
 * "Inherits from Desktop: Large" indicator.
 */
export function isInherited<T>(raw: T | ResponsiveValue<T> | undefined, device: DeviceWidth): boolean {
  if (device === 'desktop') return false
  const asObject = asResponsiveObject(raw)
  if (!asObject) return true // a legacy plain value (or nothing) has no explicit tablet/mobile override
  return asObject[device] == null
}

/**
 * Sets exactly one device's value, preserving whatever raw shape the other
 * devices currently have -- including "not yet set" (i.e. still inheriting)
 * -- rather than freezing them at their currently-resolved value. This is
 * the write-side counterpart to normalizeResponsive(): that function is for
 * reading/rendering (always fully resolved, no nulls); this one is for
 * editing (never materializes an override the user didn't actually make).
 */
export function withDeviceOverride<T>(
  raw: T | ResponsiveValue<T> | undefined,
  device: DeviceWidth,
  value: T,
  fallback: T
): ResponsiveValue<T> {
  const asObject = asResponsiveObject(raw)
  const base: ResponsiveValue<T> = asObject ?? { desktop: (raw as T | undefined) ?? fallback }
  return { ...base, [device]: value }
}
