import { SOCIAL_ICON, type SocialIcon } from '@/lib/socialIcons'

export const SOCIAL_PLATFORMS: { key: string; label: string; icon: SocialIcon; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: SOCIAL_ICON.instagram, placeholder: 'https://instagram.com/…' },
  { key: 'facebook', label: 'Facebook', icon: SOCIAL_ICON.facebook, placeholder: 'https://facebook.com/…' },
  { key: 'tiktok', label: 'TikTok', icon: SOCIAL_ICON.tiktok, placeholder: 'https://tiktok.com/@…' },
  { key: 'youtube', label: 'YouTube', icon: SOCIAL_ICON.youtube, placeholder: 'https://youtube.com/@…' },
  { key: 'x', label: 'X', icon: SOCIAL_ICON.x, placeholder: 'https://x.com/…' },
  { key: 'spotify', label: 'Spotify', icon: SOCIAL_ICON.spotify, placeholder: 'https://open.spotify.com/artist/…' },
  { key: 'soundcloud', label: 'SoundCloud', icon: SOCIAL_ICON.soundcloud, placeholder: 'https://soundcloud.com/…' },
  { key: 'website', label: 'Website', icon: SOCIAL_ICON.website, placeholder: 'https://…' },
]

export const SOCIAL_PLATFORM_ICON = SOCIAL_ICON
