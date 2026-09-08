import {
  SiBandcamp,
  SiDeezer,
  SiFacebook,
  SiInstagram,
  SiSoundcloud,
  SiSpotify,
  SiTiktok,
  SiX,
  SiYoutube,
} from '@icons-pack/react-simple-icons'
import { Globe, Link as LinkIcon } from 'lucide-react'
import type { ComponentType } from 'react'

export type SocialIcon = ComponentType<{ className?: string }>

// Real brand marks (via simple-icons) rather than lucide-react generic
// stand-ins — this version of lucide-react ships no dedicated brand icons.
// "Website" has no brand of its own, so it keeps a generic globe; "custom"
// (a link with no fixed platform) falls back to a generic chain-link icon
// when the artist didn't upload their own icon image for it.
export const SOCIAL_ICON: Record<string, SocialIcon> = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  tiktok: SiTiktok,
  youtube: SiYoutube,
  x: SiX,
  spotify: SiSpotify,
  soundcloud: SiSoundcloud,
  bandcamp: SiBandcamp,
  deezer: SiDeezer,
  website: Globe,
  custom: LinkIcon,
}
