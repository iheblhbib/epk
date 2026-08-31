import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const justVerified = searchParams.get('verified') === '1'

  return (
    <AuthCard
      title={t('auth.login.title')}
      description={t('auth.login.description')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-foreground hover:underline">
            {t('auth.login.signUp')}
          </Link>
        </>
      }
    >
      {justVerified && (
        <div className="mb-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {t('auth.login.justVerified')}
        </div>
      )}
      <LoginForm />
    </AuthCard>
  )
}
