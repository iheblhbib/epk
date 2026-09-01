import { FileText, Film, ImageIcon, Music } from 'lucide-react'
import type { Media, MediaType } from '@/types'

const TYPE_ICON: Record<MediaType, typeof Music> = {
  image: ImageIcon,
  audio: Music,
  video: Film,
  document: FileText,
}

/**
 * A real thumbnail for images (the only type the backend generates one
 * for — see MediaUploadService), a type-specific icon otherwise. Shared
 * between the media picker dialog and the Media Library list so both
 * render files identically.
 */
export function MediaThumb({ media }: { media: Media }) {
  const Icon = TYPE_ICON[media.type]

  return media.type === 'image' ? (
    <img src={media.thumbnail_url ?? media.url} alt={media.original_filename} className="size-full object-cover" />
  ) : (
    <Icon className="size-6 text-muted-foreground" />
  )
}
