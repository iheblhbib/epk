import { Download, ExternalLink, Globe, Mail, MapPin, PlayCircle, Phone, Quote, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SOCIAL_PLATFORM_ICON } from '@/features/epks/builder/socialPlatforms'
import { useMediaList } from '@/features/media/hooks/useMedia'
import { buttonRadiusClass, resolveTheme, themeToCssVars, type EpkCustomSettings, type HeaderStyle } from '@/lib/epkThemes'
import { cn } from '@/lib/utils'
import type {
  BiographyConfig,
  ContactConfig,
  CreditsConfig,
  CustomConfig,
  DownloadsConfig,
  Epk,
  EpkSection,
  HeroConfig,
  MusicConfig,
  PhotosConfig,
  PressConfig,
  ReleaseLinks,
  ReleasesConfig,
  SocialNetworksConfig,
  VideosConfig,
} from '@/types'

const RELEASE_LINK_LABELS: Record<keyof ReleaseLinks, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  deezer: 'Deezer',
  bandcamp: 'Bandcamp',
}

const HEIGHT_CLASS: Record<string, string> = {
  small: 'min-h-[16rem]',
  medium: 'min-h-[22rem]',
  large: 'min-h-[30rem]',
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'items-start text-start',
  center: 'items-center text-center',
  right: 'items-end text-end',
}

// Mirrors PublicEpkPage's PROSE_THEME_CLASSES so the builder preview matches
// the actual public output instead of the admin app's own light/dark theme.
const PROSE_THEME_CLASSES =
  'prose-headings:text-[var(--epk-fg)] prose-p:text-[var(--epk-fg)] prose-strong:text-[var(--epk-fg)] prose-em:text-[var(--epk-fg)] prose-li:text-[var(--epk-fg)] prose-a:text-[var(--epk-accent)] prose-blockquote:text-[var(--epk-muted)] prose-blockquote:border-[var(--epk-border)]'

function findMediaUrl(media: { id: number; url: string }[] | undefined, id: number | null | undefined) {
  return media?.find((item) => item.id === id)?.url
}

function SectionHeading({ title, headerStyle }: { title: string; headerStyle: HeaderStyle }) {
  if (headerStyle === 'minimal') {
    return <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-[var(--epk-muted)] uppercase">{title}</p>
  }
  if (headerStyle === 'centered') {
    return (
      <div className="mb-3 flex flex-col items-center gap-1.5 text-center">
        <h2 className="text-xl font-semibold text-[var(--epk-fg)]">{title}</h2>
        <div className="h-0.5 w-8 bg-[var(--epk-accent)]" />
      </div>
    )
  }
  return <h2 className="mb-3 text-xl font-semibold text-[var(--epk-fg)]">{title}</h2>
}

function HeroPreview({
  config,
  epk,
  workspaceId,
  buttonStyle,
}: {
  config: HeroConfig
  epk: Epk
  workspaceId: number
  buttonStyle: ReturnType<typeof resolveTheme>['buttonStyle']
}) {
  const { data: media } = useMediaList(workspaceId)
  const background = findMediaUrl(media, config.background_media_id)
  const profile = findMediaUrl(media, config.profile_media_id)

  return (
    <div
      className={cn(
        'relative flex flex-col justify-center gap-3 overflow-hidden px-8 py-12',
        HEIGHT_CLASS[config.height ?? 'large'],
        ALIGN_CLASS[config.alignment ?? 'center']
      )}
      style={
        background
          ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'var(--epk-accent)', color: 'var(--epk-accent-fg)' }
      }
    >
      {background && (config.overlay ?? true) && <div className="absolute inset-0 bg-black/50" />}
      <div
        className={cn('relative z-10 flex flex-col gap-3', ALIGN_CLASS[config.alignment ?? 'center'])}
        style={background ? { color: '#ffffff' } : undefined}
      >
        {profile && (
          <img src={profile} alt="" className="size-20 rounded-full border-2 border-white/80 object-cover" />
        )}
        <h1 className="text-3xl font-semibold sm:text-4xl">{config.headline || epk.artist?.name || epk.title}</h1>
        {config.subtitle && <p className="text-lg opacity-90">{config.subtitle}</p>}
        {config.description && <p className="max-w-xl text-sm opacity-75">{config.description}</p>}
        {config.cta_label && config.cta_url && (
          <a
            href={config.cta_url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.preventDefault()}
            className={cn(
              'mt-2 inline-flex w-fit items-center bg-[var(--epk-bg)] px-4 py-2 text-sm font-medium text-[var(--epk-fg)]',
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

function BiographyPreview({ config, headerStyle }: { config: BiographyConfig; headerStyle: HeaderStyle }) {
  return (
    <div className="px-8 py-10">
      <SectionHeading title="Biography" headerStyle={headerStyle} />
      {config.html ? (
        // Rendered from the same HTML the rich-text editor just produced (and
        // the backend re-sanitizes on save) — no new injection surface here.
        <div className={cn('prose prose-sm max-w-none', PROSE_THEME_CLASSES)} dangerouslySetInnerHTML={{ __html: config.html }} />
      ) : (
        <p className="text-sm text-[var(--epk-muted)]">No biography yet.</p>
      )}
    </div>
  )
}

function SocialNetworksPreview({ config, headerStyle }: { config: SocialNetworksConfig; headerStyle: HeaderStyle }) {
  const links = (config.links ?? []).filter((link) => link.url)

  if (links.length === 0) {
    return (
      <div className="px-8 py-10 text-center text-sm text-[var(--epk-muted)]">No social links added yet.</div>
    )
  }

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Social Networks" headerStyle={headerStyle} />
      <div className="flex flex-wrap justify-center gap-4">
        {links.map((link) => {
          const Icon = SOCIAL_PLATFORM_ICON[link.platform] ?? Globe
          return (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.preventDefault()}
              className="flex size-10 items-center justify-center rounded-full border border-[var(--epk-border)] text-[var(--epk-fg)]"
            >
              <Icon className="size-4" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

function ContactPreview({ config, headerStyle }: { config: ContactConfig; headerStyle: HeaderStyle }) {
  const rows: { icon: LucideIcon; label: string }[] = []
  if (config.booking_email) rows.push({ icon: Mail, label: `Booking: ${config.booking_email}` })
  if (config.press_email) rows.push({ icon: Mail, label: `Press: ${config.press_email}` })
  if (config.management_email) rows.push({ icon: Mail, label: `Management: ${config.management_email}` })
  if (config.website) rows.push({ icon: Globe, label: config.website })
  if (config.show_phone && config.phone) rows.push({ icon: Phone, label: config.phone })
  if (config.show_address && config.address) rows.push({ icon: MapPin, label: config.address })

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Contact" headerStyle={headerStyle} />
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No contact details yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-[var(--epk-fg)]">
              <row.icon className="size-4 text-[var(--epk-muted)]" />
              {row.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DownloadsPreview({ config, workspaceId, headerStyle }: { config: DownloadsConfig; workspaceId: number; headerStyle: HeaderStyle }) {
  const { data: media } = useMediaList(workspaceId)
  const files = (config.media_ids ?? []).map((id) => media?.find((item) => item.id === id)).filter(Boolean)

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Downloads" headerStyle={headerStyle} />
      {files.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No downloadable files selected yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file!.id}
              className="flex items-center justify-between border border-[var(--epk-border)] px-3 py-2 text-sm"
              style={{ borderRadius: 'var(--epk-radius)' }}
            >
              <span className="truncate text-[var(--epk-fg)]">{file!.original_filename}</span>
              <Download className="size-4 shrink-0 text-[var(--epk-muted)]" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreditsPreview({ config, headerStyle }: { config: CreditsConfig; headerStyle: HeaderStyle }) {
  const items = config.items ?? []

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Credits" headerStyle={headerStyle} />
      {items.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No credits yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item, index) => (
            <li key={index} className="flex justify-between gap-4">
              <span className="text-[var(--epk-muted)]">{item.role || '—'}</span>
              <span className="text-[var(--epk-fg)]">{item.name || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CustomPreview({ config, headerStyle }: { config: CustomConfig; headerStyle: HeaderStyle }) {
  return (
    <div className="px-8 py-10">
      {config.heading && <SectionHeading title={config.heading} headerStyle={headerStyle} />}
      {config.html ? (
        <div className={cn('prose prose-sm max-w-none', PROSE_THEME_CLASSES)} dangerouslySetInnerHTML={{ __html: config.html }} />
      ) : (
        <p className="text-sm text-[var(--epk-muted)]">Empty section.</p>
      )}
    </div>
  )
}

function PhotosPreview({ config, workspaceId, headerStyle }: { config: PhotosConfig; workspaceId: number; headerStyle: HeaderStyle }) {
  const { data: media } = useMediaList(workspaceId)
  const items = (config.items ?? [])
    .map((item) => ({ ...item, media: media?.find((m) => m.id === item.media_id) }))
    .filter((item) => item.media)

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Photos" headerStyle={headerStyle} />
      {items.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item, index) => (
            <figure key={index} className="space-y-1">
              <div className="aspect-square overflow-hidden rounded-md bg-muted">
                <img
                  src={item.media!.thumbnail_url ?? item.media!.url}
                  alt={item.caption ?? ''}
                  className="size-full object-cover"
                />
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
      )}
    </div>
  )
}

function MusicPreview({ config, workspaceId, headerStyle }: { config: MusicConfig; workspaceId: number; headerStyle: HeaderStyle }) {
  const { data: media } = useMediaList(workspaceId)
  const tracks = (config.tracks ?? [])
    .map((track) => ({ ...track, media: media?.find((m) => m.id === track.audio_media_id) }))
    .filter((track) => track.media)

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Music" headerStyle={headerStyle} />
      {tracks.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No tracks yet.</p>
      ) : (
        <ul className="space-y-3">
          {tracks.map((track, index) => (
            <li key={index}>
              <p className="mb-1 text-sm font-medium text-[var(--epk-fg)]">{track.title || track.media!.original_filename}</p>
              <audio controls src={track.media!.url} className="h-9 w-full" onClick={(event) => event.preventDefault()} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReleasesPreview({
  config,
  workspaceId,
  headerStyle,
  buttonStyle,
}: {
  config: ReleasesConfig
  workspaceId: number
  headerStyle: HeaderStyle
  buttonStyle: ReturnType<typeof resolveTheme>['buttonStyle']
}) {
  const { data: media } = useMediaList(workspaceId)
  const releases = config.releases ?? []

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Releases" headerStyle={headerStyle} />
      {releases.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No releases yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {releases.map((release, index) => {
            const cover = media?.find((m) => m.id === release.cover_media_id)
            const links = Object.entries(release.links ?? {}).filter(([, url]) => url)
            return (
              <div key={index} className="space-y-2">
                <div className="aspect-square overflow-hidden rounded-md bg-muted">
                  {cover && <img src={cover.thumbnail_url ?? cover.url} alt="" className="size-full object-cover" />}
                </div>
                <p className="text-sm font-medium text-[var(--epk-fg)]">{release.title || 'Untitled release'}</p>
                {links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {links.map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.preventDefault()}
                        className={cn('bg-[var(--epk-accent)] px-2 py-1 text-xs text-[var(--epk-accent-fg)]', buttonRadiusClass(buttonStyle))}
                      >
                        {RELEASE_LINK_LABELS[key as keyof ReleaseLinks]}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VideosPreview({ config, workspaceId, headerStyle }: { config: VideosConfig; workspaceId: number; headerStyle: HeaderStyle }) {
  const { data: media } = useMediaList(workspaceId)
  const videos = config.videos ?? []

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Videos" headerStyle={headerStyle} />
      {videos.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No videos yet.</p>
      ) : (
        <ul className="space-y-2">
          {videos.map((video, index) => {
            if (video.provider === 'upload') {
              const file = media?.find((m) => m.id === video.media_id)
              return (
                <li key={index} className="space-y-1">
                  {video.title && <p className="text-sm font-medium text-[var(--epk-fg)]">{video.title}</p>}
                  {file ? (
                    <video src={file.url} controls className="aspect-video w-full rounded-md bg-black" onClick={(event) => event.preventDefault()} />
                  ) : (
                    <p className="text-sm text-[var(--epk-muted)]">No file selected yet.</p>
                  )}
                </li>
              )
            }
            // Embed rendering for YouTube/Vimeo is left to the public page
            // (which has the server-resolved embed URL) — the builder just
            // confirms a link was entered.
            return (
              <li key={index} className="flex items-center gap-2 rounded-md border border-[var(--epk-border)] px-3 py-2 text-sm">
                <PlayCircle className="size-4 shrink-0 text-[var(--epk-muted)]" />
                <span className="truncate text-[var(--epk-fg)]">{video.title || video.url || 'Untitled video'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function PressPreview({ config, headerStyle }: { config: PressConfig; headerStyle: HeaderStyle }) {
  const items = (config.items ?? []).filter((item) => item.outlet)

  return (
    <div className="px-8 py-10">
      <SectionHeading title="Press" headerStyle={headerStyle} />
      {items.length === 0 ? (
        <p className="text-sm text-[var(--epk-muted)]">No press coverage yet.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item, index) => (
            <li key={index} className="space-y-1">
              {item.quote && (
                <blockquote className="flex gap-2 text-sm text-[var(--epk-fg)] italic">
                  <Quote className="size-3.5 shrink-0 text-[var(--epk-muted)]" />
                  {item.quote}
                </blockquote>
              )}
              <p className="text-xs text-[var(--epk-muted)]">
                {item.outlet}
                {item.author && ` · ${item.author}`}
                {item.article_url && (
                  <a
                    href={item.article_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.preventDefault()}
                    className="ms-1 inline-flex items-center gap-0.5 text-[var(--epk-accent)]"
                  >
                    Read <ExternalLink className="size-3" />
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ComingSoonPreview({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-10 text-center">
      <Sparkles className="size-5 text-[var(--epk-muted)]" />
      <p className="text-sm text-[var(--epk-muted)]">{label} content arrives in a later phase.</p>
    </div>
  )
}

export function LivePreview({
  epk,
  workspaceId,
  sections,
  selectedSectionId,
  onSelectSection,
}: {
  epk: Epk
  workspaceId: number
  sections: EpkSection[]
  selectedSectionId: number | null
  onSelectSection: (id: number) => void
}) {
  const enabled = sections.filter((section) => section.is_enabled)
  const theme = resolveTheme(epk.theme, epk.custom_settings as EpkCustomSettings | null)
  const themeStyle = { ...themeToCssVars(theme), fontFamily: 'var(--epk-font)' }

  if (enabled.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center bg-[var(--epk-bg)] p-10 text-center text-sm text-[var(--epk-muted)]"
        style={themeStyle}
      >
        No sections enabled. Add or enable a section to see the preview.
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--epk-border)] bg-[var(--epk-bg)]" style={themeStyle}>
      {enabled.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelectSection(section.id)}
          className={cn(
            'block w-full text-start outline-none transition-shadow',
            selectedSectionId === section.id && 'ring-2 ring-inset ring-primary'
          )}
        >
          {(() => {
            switch (section.type) {
              case 'hero':
                return (
                  <HeroPreview
                    config={section.config as HeroConfig}
                    epk={epk}
                    workspaceId={workspaceId}
                    buttonStyle={theme.buttonStyle}
                  />
                )
              case 'biography':
                return <BiographyPreview config={section.config as BiographyConfig} headerStyle={theme.headerStyle} />
              case 'social_networks':
                return <SocialNetworksPreview config={section.config as SocialNetworksConfig} headerStyle={theme.headerStyle} />
              case 'contact':
                return <ContactPreview config={section.config as ContactConfig} headerStyle={theme.headerStyle} />
              case 'downloads':
                return (
                  <DownloadsPreview
                    config={section.config as DownloadsConfig}
                    workspaceId={workspaceId}
                    headerStyle={theme.headerStyle}
                  />
                )
              case 'credits':
                return <CreditsPreview config={section.config as CreditsConfig} headerStyle={theme.headerStyle} />
              case 'custom':
                return <CustomPreview config={section.config as CustomConfig} headerStyle={theme.headerStyle} />
              case 'photos':
                return (
                  <PhotosPreview config={section.config as PhotosConfig} workspaceId={workspaceId} headerStyle={theme.headerStyle} />
                )
              case 'music':
                return (
                  <MusicPreview config={section.config as MusicConfig} workspaceId={workspaceId} headerStyle={theme.headerStyle} />
                )
              case 'releases':
                return (
                  <ReleasesPreview
                    config={section.config as ReleasesConfig}
                    workspaceId={workspaceId}
                    headerStyle={theme.headerStyle}
                    buttonStyle={theme.buttonStyle}
                  />
                )
              case 'videos':
                return (
                  <VideosPreview config={section.config as VideosConfig} workspaceId={workspaceId} headerStyle={theme.headerStyle} />
                )
              case 'press':
                return <PressPreview config={section.config as PressConfig} headerStyle={theme.headerStyle} />
              default:
                return <ComingSoonPreview label={section.label} />
            }
          })()}
        </button>
      ))}
    </div>
  )
}
