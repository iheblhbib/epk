import { AtSign, Camera, Download, ExternalLink, Globe, Mail, MapPin, MessageCircle, Music2, Music4, Phone, Quote, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRef } from 'react'
import { buttonRadiusClass, resolveTheme, type HeaderStyle } from '@/lib/epkThemes'
import { cn } from '@/lib/utils'
import type {
  AnalyticsEventType,
  PublicBiographyConfig,
  PublicContactConfig,
  PublicCreditsConfig,
  PublicCustomConfig,
  PublicDownloadsConfig,
  PublicEpkSection,
  PublicHeroConfig,
  PublicMusicConfig,
  PublicPhotosConfig,
  PublicPressConfig,
  PublicReleasesConfig,
  PublicSocialNetworksConfig,
  PublicVideosConfig,
  ReleaseLinks,
} from '@/types'

/**
 * Shared between the public /epk/{slug} page and the private /private/{token}
 * page — both render the exact same section types from the exact same
 * resolved config shape, they just fetch that data and report analytics
 * events through different endpoints. Callers supply `onTrack` to point
 * events at whichever endpoint applies.
 */
export type TrackFn = (type: AnalyticsEventType, meta?: { filename?: string }) => void

const RELEASE_LINK_LABELS: Record<keyof ReleaseLinks, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  deezer: 'Deezer',
  bandcamp: 'Bandcamp',
}

// Same generic stand-ins used in the builder (this lucide-react version
// doesn't ship dedicated brand icons).
const SOCIAL_ICON: Record<string, LucideIcon> = {
  instagram: Camera,
  facebook: MessageCircle,
  tiktok: Music2,
  youtube: Video,
  x: AtSign,
  spotify: Music4,
  soundcloud: Music2,
  website: Globe,
}

const HEIGHT_CLASS: Record<string, string> = {
  small: 'min-h-[20rem]',
  medium: 'min-h-[28rem]',
  large: 'min-h-[38rem]',
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'items-start text-start',
  center: 'items-center text-center',
  right: 'items-end text-end',
}

// Overrides Tailwind Typography's own default palette with the EPK's theme
// tokens, so rich text (Biography/Custom) stays legible against a dark
// theme's background instead of rendering near-invisible default grays.
const PROSE_THEME_CLASSES =
  'prose-headings:text-[var(--epk-fg)] prose-p:text-[var(--epk-fg)] prose-strong:text-[var(--epk-fg)] prose-em:text-[var(--epk-fg)] prose-li:text-[var(--epk-fg)] prose-a:text-[var(--epk-accent)] prose-blockquote:text-[var(--epk-muted)] prose-blockquote:border-[var(--epk-border)]'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`
}

function HeroSection({
  config,
  fallbackTitle,
  buttonStyle,
}: {
  config: PublicHeroConfig
  fallbackTitle: string
  buttonStyle: ReturnType<typeof resolveTheme>['buttonStyle']
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col justify-center gap-4 overflow-hidden px-6 py-16 sm:px-12',
        HEIGHT_CLASS[config.height] ?? HEIGHT_CLASS.large,
        ALIGN_CLASS[config.alignment] ?? ALIGN_CLASS.center
      )}
      style={
        config.background_image_url
          ? { backgroundImage: `url(${config.background_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'var(--epk-accent)', color: 'var(--epk-accent-fg)' }
      }
    >
      {config.background_image_url && config.overlay && <div className="absolute inset-0 bg-black/55" />}
      <div
        className={cn('relative z-10 mx-auto flex max-w-3xl flex-col gap-4', ALIGN_CLASS[config.alignment] ?? ALIGN_CLASS.center)}
        style={config.background_image_url ? { color: '#ffffff' } : undefined}
      >
        {config.profile_image_url && (
          <img
            src={config.profile_image_url}
            alt=""
            className="size-24 rounded-full border-2 border-white/80 object-cover shadow-lg"
          />
        )}
        <h1 className="text-4xl font-semibold sm:text-5xl">{config.headline || fallbackTitle}</h1>
        {config.subtitle && <p className="text-xl opacity-90">{config.subtitle}</p>}
        {config.description && <p className="max-w-xl text-base opacity-75">{config.description}</p>}
        {config.cta_label && config.cta_url && (
          <a
            href={config.cta_url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'mt-2 inline-flex w-fit items-center bg-[var(--epk-bg)] px-5 py-2.5 text-sm font-medium text-[var(--epk-fg)] transition-opacity hover:opacity-90',
              buttonRadiusClass(buttonStyle)
            )}
          >
            {config.cta_label}
          </a>
        )}
      </div>
    </div>
  )
}

function SectionHeading({ title, headerStyle }: { title: string; headerStyle: HeaderStyle }) {
  if (headerStyle === 'minimal') {
    return (
      <p className="mb-6 text-xs font-semibold tracking-[0.2em] text-[var(--epk-muted)] uppercase">{title}</p>
    )
  }

  if (headerStyle === 'centered') {
    return (
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-semibold text-[var(--epk-fg)]">{title}</h2>
        <div className="h-0.5 w-10 bg-[var(--epk-accent)]" />
      </div>
    )
  }

  return <h2 className="mb-6 text-2xl font-semibold text-[var(--epk-fg)]">{title}</h2>
}

function SectionContainer({
  title,
  headerStyle,
  align,
  children,
}: {
  title?: string
  headerStyle: HeaderStyle
  align?: 'center'
  children: React.ReactNode
}) {
  return (
    <section
      className={cn('mx-auto max-w-3xl px-6', align === 'center' && 'flex flex-col items-center text-center')}
      style={{ paddingTop: 'var(--epk-section-gap)', paddingBottom: 'var(--epk-section-gap)' }}
    >
      {title && <SectionHeading title={title} headerStyle={headerStyle} />}
      {children}
    </section>
  )
}

function BiographySection({ title, headerStyle, config }: { title: string; headerStyle: HeaderStyle; config: PublicBiographyConfig }) {
  if (!config.html) return null
  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <div className={cn('prose max-w-none', PROSE_THEME_CLASSES)} dangerouslySetInnerHTML={{ __html: config.html }} />
    </SectionContainer>
  )
}

function SocialNetworksSection({ title, headerStyle, config }: { title: string; headerStyle: HeaderStyle; config: PublicSocialNetworksConfig }) {
  const links = (config.links ?? []).filter((link) => link.url)
  if (links.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle} align="center">
      <div className="flex flex-wrap justify-center gap-3">
        {links.map((link) => {
          const Icon = SOCIAL_ICON[link.platform] ?? Globe
          return (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex size-11 items-center justify-center rounded-full border border-[var(--epk-border)] text-[var(--epk-fg)] transition-colors hover:border-[var(--epk-accent)] hover:text-[var(--epk-accent)]"
              aria-label={link.platform}
            >
              <Icon className="size-5" />
            </a>
          )
        })}
      </div>
    </SectionContainer>
  )
}

function ContactSection({ title, headerStyle, config }: { title: string; headerStyle: HeaderStyle; config: PublicContactConfig }) {
  const rows: { icon: LucideIcon; label: string; href?: string }[] = []
  if (config.booking_email) rows.push({ icon: Mail, label: `Booking · ${config.booking_email}`, href: `mailto:${config.booking_email}` })
  if (config.press_email) rows.push({ icon: Mail, label: `Press · ${config.press_email}`, href: `mailto:${config.press_email}` })
  if (config.management_email) rows.push({ icon: Mail, label: `Management · ${config.management_email}`, href: `mailto:${config.management_email}` })
  if (config.website) rows.push({ icon: Globe, label: config.website, href: config.website })
  if (config.phone) rows.push({ icon: Phone, label: config.phone, href: `tel:${config.phone}` })
  if (config.address) rows.push({ icon: MapPin, label: config.address })
  if (rows.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-3 text-base text-[var(--epk-fg)]">
            <row.icon className="size-4 shrink-0 text-[var(--epk-muted)]" />
            {row.href ? (
              <a href={row.href} target="_blank" rel="noreferrer" className="hover:text-[var(--epk-accent)]">
                {row.label}
              </a>
            ) : (
              row.label
            )}
          </li>
        ))}
      </ul>
    </SectionContainer>
  )
}

function DownloadsSection({
  title,
  headerStyle,
  config,
  onTrack,
}: {
  title: string
  headerStyle: HeaderStyle
  config: PublicDownloadsConfig
  onTrack: TrackFn
}) {
  if (!config.files || config.files.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <ul className="space-y-2">
        {config.files.map((file) => (
          <li key={file.id}>
            {/* No target="_blank" — file.url points at a download endpoint
                (Content-Disposition: attachment), so the browser downloads
                it directly instead of navigating. */}
            <a
              href={file.url}
              onClick={() => onTrack('download', { filename: file.filename })}
              className="flex items-center justify-between border border-[var(--epk-border)] px-4 py-3 text-sm transition-colors hover:border-[var(--epk-accent)]"
              style={{ borderRadius: 'var(--epk-radius)' }}
            >
              <span className="truncate font-medium text-[var(--epk-fg)]">{file.filename}</span>
              <span className="flex shrink-0 items-center gap-2 text-[var(--epk-muted)]">
                {formatBytes(file.size)}
                <Download className="size-4" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </SectionContainer>
  )
}

function CreditsSection({ title, headerStyle, config }: { title: string; headerStyle: HeaderStyle; config: PublicCreditsConfig }) {
  const items = (config.items ?? []).filter((item) => item.role || item.name)
  if (items.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <ul className="divide-y divide-[var(--epk-border)]">
        {items.map((item, index) => (
          <li key={index} className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-[var(--epk-muted)]">{item.role}</span>
            <span className="font-medium text-[var(--epk-fg)]">{item.name}</span>
          </li>
        ))}
      </ul>
    </SectionContainer>
  )
}

function CustomSection({ headerStyle, config }: { headerStyle: HeaderStyle; config: PublicCustomConfig }) {
  if (!config.heading && !config.html) return null

  return (
    <SectionContainer title={config.heading || undefined} headerStyle={headerStyle}>
      {config.html && (
        <div className={cn('prose max-w-none', PROSE_THEME_CLASSES)} dangerouslySetInnerHTML={{ __html: config.html }} />
      )}
    </SectionContainer>
  )
}

function PhotosSection({ title, headerStyle, config }: { title: string; headerStyle: HeaderStyle; config: PublicPhotosConfig }) {
  if (!config.items || config.items.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {config.items.map((item, index) => (
          <figure key={index} className="space-y-1.5">
            <div className="aspect-square overflow-hidden bg-[var(--epk-border)]" style={{ borderRadius: 'var(--epk-radius)' }}>
              <img src={item.url} alt={item.caption} className="size-full object-cover" loading="lazy" />
            </div>
            {(item.caption || item.credit) && (
              <figcaption className="text-xs text-[var(--epk-muted)]">
                {item.caption}
                {item.credit && <span className="block italic">{item.credit}</span>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </SectionContainer>
  )
}

/** Fires its play event at most once, no matter how many times the visitor pauses/resumes. */
function TrackAudio({ src, onFirstPlay }: { src: string; onFirstPlay: () => void }) {
  const hasPlayed = useRef(false)

  return (
    <audio
      controls
      src={src}
      className="h-10 w-full"
      onPlay={() => {
        if (hasPlayed.current) return
        hasPlayed.current = true
        onFirstPlay()
      }}
    />
  )
}

function MusicSection({
  title,
  headerStyle,
  config,
  onTrack,
}: {
  title: string
  headerStyle: HeaderStyle
  config: PublicMusicConfig
  onTrack: TrackFn
}) {
  if (!config.tracks || config.tracks.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <ul className="space-y-4">
        {config.tracks.map((track, index) => (
          <li key={index}>
            <p className="mb-1.5 text-sm font-medium text-[var(--epk-fg)]">{track.title}</p>
            <TrackAudio src={track.audio_url} onFirstPlay={() => onTrack('audio_play')} />
          </li>
        ))}
      </ul>
    </SectionContainer>
  )
}

function ReleasesSection({ title, headerStyle, buttonStyle, config }: {
  title: string
  headerStyle: HeaderStyle
  buttonStyle: ReturnType<typeof resolveTheme>['buttonStyle']
  config: PublicReleasesConfig
}) {
  if (!config.releases || config.releases.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {config.releases.map((release, index) => {
          const links = Object.entries(release.links) as [keyof ReleaseLinks, string][]
          return (
            <div key={index} className="space-y-2">
              <div className="aspect-square overflow-hidden bg-[var(--epk-border)]" style={{ borderRadius: 'var(--epk-radius)' }}>
                {release.cover_image_url && (
                  <img src={release.cover_image_url} alt={release.title} className="size-full object-cover" loading="lazy" />
                )}
              </div>
              <p className="text-sm font-medium text-[var(--epk-fg)]">{release.title}</p>
              <p className="text-xs text-[var(--epk-muted)] capitalize">
                {release.type}
                {release.release_date && ` · ${release.release_date}`}
              </p>
              {links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {links.map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'bg-[var(--epk-accent)] px-2.5 py-1 text-xs font-medium text-[var(--epk-accent-fg)] transition-opacity hover:opacity-90',
                        buttonRadiusClass(buttonStyle)
                      )}
                    >
                      {RELEASE_LINK_LABELS[key]}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </SectionContainer>
  )
}

/**
 * Fires its play event at most once. YouTube/Vimeo embeds don't get this —
 * observing play state cross-origin would mean loading each platform's JS
 * SDK, which this page deliberately keeps out of for speed/SEO.
 */
function UploadedVideo({ src, onFirstPlay }: { src?: string; onFirstPlay: () => void }) {
  const hasPlayed = useRef(false)

  return (
    <video
      src={src}
      controls
      className="size-full"
      onPlay={() => {
        if (hasPlayed.current) return
        hasPlayed.current = true
        onFirstPlay()
      }}
    />
  )
}

function VideosSection({
  title,
  headerStyle,
  config,
  onTrack,
}: {
  title: string
  headerStyle: HeaderStyle
  config: PublicVideosConfig
  onTrack: TrackFn
}) {
  if (!config.videos || config.videos.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <div className="space-y-6">
        {config.videos.map((video, index) => (
          <div key={index} className="space-y-2">
            {video.title && <p className="text-sm font-medium text-[var(--epk-fg)]">{video.title}</p>}
            <div className="aspect-video overflow-hidden bg-black" style={{ borderRadius: 'var(--epk-radius)' }}>
              {video.provider === 'upload' ? (
                <UploadedVideo src={video.video_url} onFirstPlay={() => onTrack('video_play')} />
              ) : (
                <iframe
                  src={video.embed_url}
                  title={video.title || `Video ${index + 1}`}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionContainer>
  )
}

function PressSection({ title, headerStyle, config }: { title: string; headerStyle: HeaderStyle; config: PublicPressConfig }) {
  if (!config.items || config.items.length === 0) return null

  return (
    <SectionContainer title={title} headerStyle={headerStyle}>
      <ul className="space-y-6">
        {config.items.map((item, index) => (
          <li key={index} className="space-y-1.5">
            {item.quote && (
              <blockquote className="flex gap-2 text-lg text-[var(--epk-fg)] italic">
                <Quote className="mt-1 size-4 shrink-0 text-[var(--epk-muted)]" />
                {item.quote}
              </blockquote>
            )}
            <p className="text-sm text-[var(--epk-muted)]">
              — {item.outlet}
              {item.author && `, ${item.author}`}
              {item.article_url && (
                <a
                  href={item.article_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ms-2 inline-flex items-center gap-1 text-[var(--epk-accent)] hover:underline"
                >
                  Read the piece <ExternalLink className="size-3.5" />
                </a>
              )}
            </p>
          </li>
        ))}
      </ul>
    </SectionContainer>
  )
}

export function renderSection(
  section: PublicEpkSection,
  fallbackTitle: string,
  theme: ReturnType<typeof resolveTheme>,
  onTrack: TrackFn
) {
  switch (section.type) {
    case 'hero':
      return (
        <HeroSection
          key={section.id}
          config={section.config as unknown as PublicHeroConfig}
          fallbackTitle={fallbackTitle}
          buttonStyle={theme.buttonStyle}
        />
      )
    case 'biography':
      return (
        <BiographySection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicBiographyConfig}
        />
      )
    case 'social_networks':
      return (
        <SocialNetworksSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicSocialNetworksConfig}
        />
      )
    case 'contact':
      return (
        <ContactSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicContactConfig}
        />
      )
    case 'downloads':
      return (
        <DownloadsSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicDownloadsConfig}
          onTrack={onTrack}
        />
      )
    case 'credits':
      return (
        <CreditsSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicCreditsConfig}
        />
      )
    case 'custom':
      return <CustomSection key={section.id} headerStyle={theme.headerStyle} config={section.config as unknown as PublicCustomConfig} />
    case 'photos':
      return (
        <PhotosSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicPhotosConfig}
        />
      )
    case 'music':
      return (
        <MusicSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicMusicConfig}
          onTrack={onTrack}
        />
      )
    case 'releases':
      return (
        <ReleasesSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          buttonStyle={theme.buttonStyle}
          config={section.config as unknown as PublicReleasesConfig}
        />
      )
    case 'videos':
      return (
        <VideosSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicVideosConfig}
          onTrack={onTrack}
        />
      )
    case 'press':
      return (
        <PressSection
          key={section.id}
          title={section.title}
          headerStyle={theme.headerStyle}
          config={section.config as unknown as PublicPressConfig}
        />
      )
    default:
      // Events has no public content yet.
      return null
  }
}
