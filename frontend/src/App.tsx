import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RouterProvider } from 'react-router-dom'
import { toast } from 'sonner'
import { registerSubscriptionLockedHandler } from '@/api/client'
import { Toaster } from '@/components/ui/sonner'
import { CustomDomainEpkPage } from '@/features/public-epk/CustomDomainEpkPage'
import { useSyncLocale } from '@/i18n/useSyncLocale'
import { QueryProvider } from '@/providers/QueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { router } from '@/router'

// Needs useAuth(), so it has to render inside <AuthProvider> rather than
// call the hook directly in App() — this is that one line of glue.
function LocaleSync() {
  useSyncLocale()
  return null
}

// Needs useTranslation() for the toast copy, so — like LocaleSync above —
// it's a tiny standalone component rather than logic inlined in App().
// A full-page redirect (not React Router's navigate()) is deliberate: this
// fires from inside an axios interceptor, potentially mid-render of an
// arbitrary page that has no idea it's about to be yanked away.
function SubscriptionLockRedirect() {
  const { t } = useTranslation()

  useEffect(() => {
    registerSubscriptionLockedHandler(() => {
      if (window.location.pathname !== '/billing') {
        toast.error(t('billing.lockedOut'))
        window.location.href = '/billing'
      }
    })
  }, [t])

  return null
}

// Set only when this build is deployed behind a known app domain (see
// .env.example) — comparing it against the real browser hostname is how a
// visitor arriving via someone's custom EPK domain (a CNAME pointed at this
// same static build) gets routed to CustomDomainEpkPage instead of the
// normal app router, without a dedicated env var for every custom domain
// that might ever exist. Left unset (local dev, or a deploy that hasn't
// configured it), this always resolves false and the app behaves exactly
// as it did before custom domains existed.
const APP_HOSTNAME = import.meta.env.VITE_APP_HOSTNAME
const isCustomDomainVisitor =
  typeof window !== 'undefined' && !!APP_HOSTNAME && window.location.hostname !== APP_HOSTNAME

function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <LocaleSync />
          <SubscriptionLockRedirect />
          {isCustomDomainVisitor ? <CustomDomainEpkPage /> : <RouterProvider router={router} />}
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}

export default App
