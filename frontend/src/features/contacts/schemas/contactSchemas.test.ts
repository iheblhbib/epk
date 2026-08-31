import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { createContactFormSchema } from '@/features/contacts/schemas/contactSchemas'

const contactFormSchema = createContactFormSchema(i18n.t)

describe('contactFormSchema', () => {
  it('accepts a minimal contact with just a name and category', () => {
    const result = contactFormSchema.safeParse({ name: 'Jane Critic', category: 'journalist' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(contactFormSchema.safeParse({ name: '', category: 'other' }).success).toBe(false)
  })

  it('accepts an empty-string email (optional field pattern)', () => {
    const result = contactFormSchema.safeParse({ name: 'Jane', category: 'other', email: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed email', () => {
    const result = contactFormSchema.safeParse({ name: 'Jane', category: 'other', email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown category', () => {
    const result = contactFormSchema.safeParse({ name: 'Jane', category: 'astrologer' })
    expect(result.success).toBe(false)
  })

  it('rejects a name over the max length', () => {
    const result = contactFormSchema.safeParse({ name: 'a'.repeat(256), category: 'other' })
    expect(result.success).toBe(false)
  })
})
