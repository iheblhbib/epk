import { describe, expect, it } from 'vitest'
import { isStrongPassword } from '@/lib/passwordStrength'

describe('isStrongPassword', () => {
  it('accepts a password with length, case, number, and symbol', () => {
    expect(isStrongPassword('Password123!')).toBe(true)
  })

  it('rejects a password missing a symbol', () => {
    expect(isStrongPassword('Password123')).toBe(false)
  })

  it('rejects a password missing an uppercase letter', () => {
    expect(isStrongPassword('password123!')).toBe(false)
  })

  it('rejects a password missing a number', () => {
    expect(isStrongPassword('Password!!!')).toBe(false)
  })

  it('rejects a password shorter than 8 characters', () => {
    expect(isStrongPassword('Pw1!')).toBe(false)
  })
})
