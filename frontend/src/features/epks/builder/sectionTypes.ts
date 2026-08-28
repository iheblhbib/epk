import {
  Contact2,
  Disc3,
  Download,
  FileText,
  Images,
  Mic2,
  Music2,
  Newspaper,
  Sparkles,
  Users,
  Video,
  CalendarDays,
  Share2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SectionType } from '@/types'

export const SECTION_TYPE_META: Record<SectionType, { label: string; icon: LucideIcon }> = {
  hero: { label: 'Hero', icon: Mic2 },
  biography: { label: 'Biography', icon: FileText },
  photos: { label: 'Photos', icon: Images },
  music: { label: 'Music', icon: Music2 },
  releases: { label: 'Releases', icon: Disc3 },
  videos: { label: 'Videos', icon: Video },
  press: { label: 'Press', icon: Newspaper },
  events: { label: 'Events', icon: CalendarDays },
  social_networks: { label: 'Social Networks', icon: Share2 },
  contact: { label: 'Contact', icon: Contact2 },
  downloads: { label: 'Downloads', icon: Download },
  credits: { label: 'Credits', icon: Users },
  custom: { label: 'Custom Section', icon: Sparkles },
}

// Order sections are offered in the "Add section" menu — Hero first since it's
// almost always wanted first, then content types, then structural ones.
export const ADDABLE_SECTION_ORDER: SectionType[] = [
  'hero',
  'biography',
  'photos',
  'music',
  'releases',
  'videos',
  'press',
  'events',
  'social_networks',
  'contact',
  'downloads',
  'credits',
  'custom',
]

export const SINGLETON_SECTION_TYPES: SectionType[] = ['hero']
