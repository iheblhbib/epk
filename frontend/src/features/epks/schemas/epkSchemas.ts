import { z } from 'zod'

export const epkFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  artist_id: z
    .number({ required_error: 'Select or create an artist' })
    .positive('Select or create an artist'),
  seo_title: z.string().max(255).optional().or(z.literal('')),
  seo_description: z.string().max(500).optional().or(z.literal('')),
})

export type EpkFormValues = z.infer<typeof epkFormSchema>

export const artistFormSchema = z.object({
  name: z.string().min(1, 'Artist name is required').max(255),
  genre: z.string().max(255).optional().or(z.literal('')),
  country: z.string().max(255).optional().or(z.literal('')),
})

export type ArtistFormValues = z.infer<typeof artistFormSchema>
