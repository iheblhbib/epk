import type { TFunction } from 'i18next'
import { z } from 'zod'

/**
 * Full artist profile form -- every field ArtistController's
 * Store/UpdateArtistRequest accepts. The narrower quick-create dialog used
 * inside EPK creation has its own schema (createArtistFormSchema in
 * epkSchemas.ts): name + genre + country only.
 */
export function createArtistFormSchema(t: TFunction) {
  const optionalEmail = z.string().email(t('validation.emailInvalidShort')).max(255).optional().or(z.literal(''))

  return z.object({
    name: z.string().min(1, t('validation.artistNameRequired')).max(255),
    stage_name: z.string().max(255).optional().or(z.literal('')),
    genre: z.string().max(255).optional().or(z.literal('')),
    country: z.string().max(255).optional().or(z.literal('')),
    city: z.string().max(255).optional().or(z.literal('')),
    short_bio: z.string().max(1000).optional().or(z.literal('')),
    website: z.string().url(t('validation.urlInvalid')).max(255).optional().or(z.literal('')),
    booking_email: optionalEmail,
    press_email: optionalEmail,
    management_email: optionalEmail,
  })
}

export type ArtistFormValues = z.infer<ReturnType<typeof createArtistFormSchema>>
