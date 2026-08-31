import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { createAuthSchemas } from '@/features/auth/schemas/authSchemas'

const { loginSchema, registerSchema } = createAuthSchemas(i18n.t)

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret' })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const base = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'Password123!',
    password_confirmation: 'Password123!',
  }

  it('accepts a strong, matching password', () => {
    expect(registerSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...base, password: 'Sh0rt!', password_confirmation: 'Sh0rt!' })
    expect(result.success).toBe(false)
  })

  it('rejects a password missing complexity (e.g. no symbol or uppercase)', () => {
    const result = registerSchema.safeParse({ ...base, password: 'password123', password_confirmation: 'password123' })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched password confirmation', () => {
    const result = registerSchema.safeParse({ ...base, password_confirmation: 'Different456!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('password_confirmation')
    }
  })
})
