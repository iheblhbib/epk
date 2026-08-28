import { apiClient, ensureCsrfCookie } from '@/api/client'
import type { ApiResource, User } from '@/types'

export interface LoginPayload {
  email: string
  password: string
  remember?: boolean
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface UpdateProfilePayload {
  name: string
  email: string
}

export interface UpdatePasswordPayload {
  current_password: string
  password: string
  password_confirmation: string
}

export async function getAuthUser(): Promise<User | null> {
  try {
    const { data } = await apiClient.get<ApiResource<User>>('/api/user')
    return data.data
  } catch (error) {
    if (isAxios401(error)) return null
    throw error
  }
}

export async function login(payload: LoginPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<ApiResource<User>>('/api/login', payload)
  return data.data
}

export async function register(payload: RegisterPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<ApiResource<User>>('/api/register', payload)
  return data.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/logout')
}

export async function forgotPassword(email: string): Promise<void> {
  await ensureCsrfCookie()
  await apiClient.post('/api/forgot-password', { email })
}

export async function resetPassword(payload: {
  token: string
  email: string
  password: string
  password_confirmation: string
}): Promise<void> {
  await ensureCsrfCookie()
  await apiClient.post('/api/reset-password', payload)
}

export async function resendVerificationEmail(): Promise<void> {
  await apiClient.post('/api/email/verification-notification')
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await apiClient.put<ApiResource<User>>('/api/user/profile', payload)
  return data.data
}

export async function updatePassword(payload: UpdatePasswordPayload): Promise<void> {
  await apiClient.put('/api/user/password', payload)
}

function isAxios401(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 401
  )
}
