import { RouterProvider } from 'react-router-dom'
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
          {isCustomDomainVisitor ? <CustomDomainEpkPage /> : <RouterProvider router={router} />}
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}

export default App
