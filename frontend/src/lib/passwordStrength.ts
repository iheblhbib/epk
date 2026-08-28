export interface PasswordRequirement {
  id: string
  label: string
  test: (value: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'lowercase', label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'uppercase', label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'number', label: 'A number', test: (v) => /[0-9]/.test(v) },
  { id: 'symbol', label: 'A symbol (e.g. !@#$%)', test: (v) => /[^a-zA-Z0-9]/.test(v) },
]

export function isStrongPassword(value: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(value))
}

export const PASSWORD_STRENGTH_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.'
