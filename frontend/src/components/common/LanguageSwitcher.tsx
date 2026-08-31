import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateLocale } from '@/features/auth/hooks/useUpdateLocale'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'
import { useAuth } from '@/providers/AuthProvider'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated } = useAuth()
  const updateLocale = useUpdateLocale()
  const current = i18n.resolvedLanguage as SupportedLanguage | undefined

  function select(lang: SupportedLanguage) {
    i18n.changeLanguage(lang)
    // A guest (login/register page) has no account yet to save this to —
    // the language-detector's own localStorage cache still remembers it
    // for next time either way.
    if (isAuthenticated) {
      updateLocale.mutate(lang)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Languages className="size-4" />
        <span className="sr-only">{t('language.toggle')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang} onClick={() => select(lang)}>
            {LANGUAGE_NAMES[lang]}
            {current === lang && <span className="ms-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
