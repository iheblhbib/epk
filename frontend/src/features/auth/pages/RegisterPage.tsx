import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export function RegisterPage() {
  const { t } = useTranslation()

  return (
    <AuthCard
      title={t('auth.register.title')}
      description={t('auth.register.description')}
      footer={
        <>
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Link to="/login" className="font-medium text-foreground hover:underline">
            {t('auth.register.signIn')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  )
}
