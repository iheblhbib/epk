import { SiFacebook, SiInstagram, SiSoundcloud, SiSpotify, SiTiktok, SiX, SiYoutube } from '@icons-pack/react-simple-icons'
import { Globe } from 'lucide-react'
import type { ComponentType } from 'react'

export type SocialIcon = ComponentType<{ className?: string }>

// Real brand marks (via simple-icons) rather than lucide-react generic
// stand-ins — this version of lucide-react ships no dedicated brand icons.
// "Website" has no brand of its own, so it keeps a generic globe.
export const SOCIAL_ICON: Record<string, SocialIcon> = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  tiktok: SiTiktok,
  youtube: SiYoutube,
  x: SiX,
  spotify: SiSpotify,
  soundcloud: SiSoundcloud,
  website: Globe,
}
