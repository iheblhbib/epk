import type { TFunction } from 'i18next'
import { z } from 'zod'

export const CONTACT_CATEGORIES = [
  'journalist',
  'radio',
  'blog',
  'label',
  'booking',
  'management',
  'pr',
  'other',
] as const

export function createContactFormSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(255),
    email: z.string().email(t('validation.emailInvalidShort')).max(255).optional().or(z.literal('')),
    phone: z.string().max(50).optional().or(z.literal('')),
    category: z.enum(CONTACT_CATEGORIES),
    organization: z.string().max(255).optional().or(z.literal('')),
    notes: z.string().max(5000).optional().or(z.literal('')),
  })
}

export type ContactFormValues = z.infer<ReturnType<typeof createContactFormSchema>>
