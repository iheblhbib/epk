import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RTL_LANGUAGES, type SupportedLanguage } from '@/i18n'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Two jobs, both side effects of whatever the current language is:
 *
 * 1. A signed-in user's saved locale (from their account, set via the
 *    language switcher) wins over whatever a guest-session language
 *    detector guessed — mounted once at the app root so it applies before
 *    any page renders.
 * 2. <html dir="rtl"/lang="xx"> stays in sync with the active language.
 *    The app already uses logical CSS properties (ps-/pe-/start-/end-)
 *    throughout rather than hardcoded left/right, so this is most of what
 *    RTL needs — dir is still the one thing only the browser can flip.
 */
export function useSyncLocale() {
  const { i18n } = useTranslation()
  const { user } = useAuth()

  useEffect(() => {
    if (user?.locale && user.locale !== i18n.resolvedLanguage) {
      i18n.changeLanguage(user.locale)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.locale])

  useEffect(() => {
    const lang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage
    document.documentElement.lang = lang
    document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr'
  }, [i18n.resolvedLanguage, i18n])
}
