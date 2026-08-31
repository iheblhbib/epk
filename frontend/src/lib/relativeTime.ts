const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'week', seconds: 604800 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
]

/**
 * "2 hours ago" / "in 3 days" — via Intl.RelativeTimeFormat rather than a
 * date library, so phrasing automatically follows the app's active
 * language (French "il y a 2 heures", Arabic, etc.) for free, with no
 * extra translation keys needed per unit.
 */
export function formatRelativeTime(date: string | Date, locale: string): string {
  const target = typeof date === 'string' ? new Date(date) : date
  const diffSeconds = (target.getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  for (const { unit, seconds } of UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit)
    }
  }

  return rtf.format(Math.round(diffSeconds), 'second')
}
