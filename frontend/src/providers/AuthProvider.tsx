import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { getAuthUser } from '@/api/auth'
import { registerAuthInvalidator } from '@/api/client'
import { authUserKey } from '@/lib/queryClient'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null | undefined
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: authUserKey,
    queryFn: getAuthUser,
  })

  useEffect(() => {
    registerAuthInvalidator(() => {
      queryClient.setQueryData(authUserKey, null)
    })
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
