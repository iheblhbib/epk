import type { TFunction } from 'i18next'

export interface PasswordRequirement {
  id: string
  labelKey: string
  test: (value: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length', labelKey: 'password.requirements.length', test: (v) => v.length >= 8 },
  { id: 'lowercase', labelKey: 'password.requirements.lowercase', test: (v) => /[a-z]/.test(v) },
  { id: 'uppercase', labelKey: 'password.requirements.uppercase', test: (v) => /[A-Z]/.test(v) },
  { id: 'number', labelKey: 'password.requirements.number', test: (v) => /[0-9]/.test(v) },
  { id: 'symbol', labelKey: 'password.requirements.symbol', test: (v) => /[^a-zA-Z0-9]/.test(v) },
]

export function isStrongPassword(value: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(value))
}

export function passwordStrengthMessage(t: TFunction): string {
  return t('validation.passwordStrength')
}
