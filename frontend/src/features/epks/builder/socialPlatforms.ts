import { AtSign, Camera, Globe, MessageCircle, Music2, Music4, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// lucide-react dropped dedicated brand icons (Instagram/Facebook/Twitter/…),
// so each platform gets a close generic stand-in instead.
export const SOCIAL_PLATFORMS: { key: string; label: string; icon: LucideIcon; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: Camera, placeholder: 'https://instagram.com/…' },
  { key: 'facebook', label: 'Facebook', icon: MessageCircle, placeholder: 'https://facebook.com/…' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, placeholder: 'https://tiktok.com/@…' },
  { key: 'youtube', label: 'YouTube', icon: Video, placeholder: 'https://youtube.com/@…' },
  { key: 'x', label: 'X', icon: AtSign, placeholder: 'https://x.com/…' },
  { key: 'spotify', label: 'Spotify', icon: Music4, placeholder: 'https://open.spotify.com/artist/…' },
  { key: 'soundcloud', label: 'SoundCloud', icon: Music2, placeholder: 'https://soundcloud.com/…' },
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://…' },
]

export const SOCIAL_PLATFORM_ICON: Record<string, LucideIcon> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((platform) => [platform.key, platform.icon])
)
