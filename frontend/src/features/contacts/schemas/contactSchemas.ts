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

export const contactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Enter a valid email').max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  category: z.enum(CONTACT_CATEGORIES),
  organization: z.string().max(255).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
