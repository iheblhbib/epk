import { Link, useSearchParams } from 'react-router-dom'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const justVerified = searchParams.get('verified') === '1'

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your press kits"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {justVerified && (
        <div className="mb-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Your email has been verified. You can sign in now.
        </div>
      )}
      <LoginForm />
    </AuthCard>
  )
}
