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

export const SECTION_TYPE_META: Record<SectionType, { labelKey: string; icon: LucideIcon }> = {
  hero: { labelKey: 'epkBuilder.sectionTypes.hero', icon: Mic2 },
  biography: { labelKey: 'epkBuilder.sectionTypes.biography', icon: FileText },
  photos: { labelKey: 'epkBuilder.sectionTypes.photos', icon: Images },
  music: { labelKey: 'epkBuilder.sectionTypes.music', icon: Music2 },
  releases: { labelKey: 'epkBuilder.sectionTypes.releases', icon: Disc3 },
  videos: { labelKey: 'epkBuilder.sectionTypes.videos', icon: Video },
  press: { labelKey: 'epkBuilder.sectionTypes.press', icon: Newspaper },
  events: { labelKey: 'epkBuilder.sectionTypes.events', icon: CalendarDays },
  social_networks: { labelKey: 'epkBuilder.sectionTypes.socialNetworks', icon: Share2 },
  contact: { labelKey: 'epkBuilder.sectionTypes.contact', icon: Contact2 },
  downloads: { labelKey: 'epkBuilder.sectionTypes.downloads', icon: Download },
  credits: { labelKey: 'epkBuilder.sectionTypes.credits', icon: Users },
  custom: { labelKey: 'epkBuilder.sectionTypes.custom', icon: Sparkles },
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
