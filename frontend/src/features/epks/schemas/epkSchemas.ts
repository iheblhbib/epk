import type { TFunction } from 'i18next'
import { z } from 'zod'

export function createEpkFormSchema(t: TFunction) {
  return z.object({
    title: z.string().min(1, t('validation.titleRequired')).max(255),
    artist_id: z
      .number({ required_error: t('validation.selectOrCreateArtist') })
      .positive(t('validation.selectOrCreateArtist')),
    seo_title: z.string().max(255).optional().or(z.literal('')),
    seo_description: z.string().max(500).optional().or(z.literal('')),
  })
}

export type EpkFormValues = z.infer<ReturnType<typeof createEpkFormSchema>>

export function createArtistFormSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('validation.artistNameRequired')).max(255),
    genre: z.string().max(255).optional().or(z.literal('')),
    country: z.string().max(255).optional().or(z.literal('')),
  })
}

export type ArtistFormValues = z.infer<ReturnType<typeof createArtistFormSchema>>
