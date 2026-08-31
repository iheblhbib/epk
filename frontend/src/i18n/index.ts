import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ar from '@/i18n/locales/ar.json'
import de from '@/i18n/locales/de.json'
import en from '@/i18n/locales/en.json'
import es from '@/i18n/locales/es.json'
import fr from '@/i18n/locales/fr.json'
import pt from '@/i18n/locales/pt.json'
import zh from '@/i18n/locales/zh.json'

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'es', 'pt', 'de', 'zh'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  zh: '中文',
}

export const RTL_LANGUAGES: SupportedLanguage[] = ['ar']

// Mirrors backend/app/Enums/Locale.php exactly — every code here must have
// a matching case there, since a logged-in user's choice round-trips
// through `PUT /api/user/locale`.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
      es: { translation: es },
      pt: { translation: pt },
      de: { translation: de },
      zh: { translation: zh },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    // Guest detection only — once a user is authenticated, AuthProvider
    // (see useSyncLocale) overrides this with their saved preference,
    // which then wins on every later load via the same localStorage key
    // languageDetector itself reads from.
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes.
    },
  })

export default i18n
