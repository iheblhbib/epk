import { FileText, Film, FolderOpen, ImageIcon, Music, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MediaCard } from '@/features/media/components/MediaCard'
import { MediaUploadZone } from '@/features/media/components/MediaUploadZone'
import { useMediaList } from '@/features/media/hooks/useMedia'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { useAudioPreview } from '@/hooks/useAudioPreview'
import { isEditorLevel } from '@/lib/permissions'
import type { MediaListParams } from '@/api/media'
import type { Media, MediaType } from '@/types'
import type { TFunction } from 'i18next'

const TYPE_VALUES: (MediaType | 'all')[] = ['all', 'image', 'audio', 'video', 'document']
const TYPE_LABEL_KEYS: Record<MediaType | 'all', string> = {
  all: 'media.types.all',
  image: 'media.types.image',
  audio: 'media.types.audio',
  video: 'media.types.video',
  document: 'media.types.document',
}

// Fixed display order for the "All types" view — music, then video, then
// images, then documents, per how the user wants to scan the library. Only
// relevant when nothing narrows it to a single type already (the type
// filter already gives a flat, single-type list, where grouping would just
// be a redundant single heading).
const GROUP_ORDER: MediaType[] = ['audio', 'video', 'image', 'document']
const GROUP_ICON: Record<MediaType, typeof Music> = {
  audio: Music,
  video: Film,
  image: ImageIcon,
  document: FileText,
}

const SORT_OPTIONS: { value: string; sortBy: MediaListParams['sortBy']; sortDir: MediaListParams['sortDir']; labelKey: string }[] = [
  { value: 'newest', sortBy: 'created_at', sortDir: 'desc', labelKey: 'media.sort.newest' },
  { value: 'oldest', sortBy: 'created_at', sortDir: 'asc', labelKey: 'media.sort.oldest' },
  { value: 'name_asc', sortBy: 'name', sortDir: 'asc', labelKey: 'media.sort.nameAsc' },
  { value: 'name_desc', sortBy: 'name', sortDir: 'desc', labelKey: 'media.sort.nameDesc' },
  { value: 'size_desc', sortBy: 'size', sortDir: 'desc', labelKey: 'media.sort.sizeDesc' },
  { value: 'size_asc', sortBy: 'size', sortDir: 'asc', labelKey: 'media.sort.sizeAsc' },
]

// Select.Value only shows the selected item's label automatically when
// Select.Root is given this value->label map — otherwise (since these
// values differ from their display labels) it falls back to the raw value.
function typeItems(t: TFunction) {
  return Object.fromEntries(TYPE_VALUES.map((value) => [value, t(TYPE_LABEL_KEYS[value])]))
}
function sortItems(t: TFunction) {
  return Object.fromEntries(SORT_OPTIONS.map((option) => [option.value, t(option.labelKey)]))
}

export function MediaLibraryPage() {
  const { t } = useTranslation()
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<MediaType | 'all'>('all')
  const [sort, setSort] = useState('newest')

  const sortOption = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0]
  const canEdit = isEditorLevel(currentWorkspace?.my_role)
  const typeOpts = typeItems(t)
  const sortOpts = sortItems(t)
  // Owned here (not per-row) so playing one track's preview stops whichever
  // other row was already playing — see MediaPicker, which needs the exact
  // same behavior for the same reason.
  const { playingId, audioRef, toggle: toggleAudioPreview, stop: stopAudioPreview } = useAudioPreview()

  const { data: media, isLoading } = useMediaList(currentWorkspace?.id, {
    search: search || undefined,
    type: type === 'all' ? undefined : type,
    sortBy: sortOption.sortBy,
    sortDir: sortOption.sortDir,
  })

  // Only grouped in the "All types" view — the type filter already narrows
  // the list to one type, where a single group heading would be redundant.
  // The chosen sort still applies within each group; only the grouping
  // itself (and the fixed audio → video → image → document order) is new.
  const groupedMedia: { type: MediaType; items: Media[] }[] =
    type === 'all' && media
      ? GROUP_ORDER.map((groupType) => ({
          type: groupType,
          items: media.filter((item) => item.type === groupType),
        })).filter((group) => group.items.length > 0)
      : []

  if (workspaceLoading) {
    return <LoadingSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={FolderOpen}
        title={t('common.noWorkspaceYet')}
        description={t('media.emptyState.noWorkspaceDescription')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.mediaLibrary')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('media.pageDescription', { workspace: currentWorkspace.name })}
        </p>
      </div>

      {canEdit && <MediaUploadZone workspaceId={currentWorkspace.id} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('media.searchPlaceholder')}
            className="ps-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          items={typeOpts}
          value={type}
          onValueChange={(value) => setType((value ?? 'all') as MediaType | 'all')}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {typeOpts[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={sortOpts} value={sort} onValueChange={(value) => setSort(value ?? 'newest')}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {sortOpts[option.value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !media || media.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search || type !== 'all' ? t('media.emptyState.noMatchTitle') : t('media.emptyState.noneTitle')}
          description={
            search || type !== 'all'
              ? t('media.emptyState.noMatchDescription')
              : canEdit
                ? t('media.emptyState.canEditDescription')
                : t('media.emptyState.viewOnlyDescription')
          }
        />
      ) : type === 'all' ? (
        <div className="space-y-6">
          {groupedMedia.map((group) => {
            const GroupIcon = GROUP_ICON[group.type]
            return (
              <div key={group.type} className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <GroupIcon className="size-4 text-muted-foreground" />
                  {t(TYPE_LABEL_KEYS[group.type])}
                  <span className="text-muted-foreground">({group.items.length})</span>
                </div>
                {group.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    media={item}
                    workspaceId={currentWorkspace.id}
                    myRole={currentWorkspace.my_role}
                    isPlaying={playingId === item.id}
                    onTogglePreview={() => toggleAudioPreview(item.id, item.url)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {media.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              workspaceId={currentWorkspace.id}
              myRole={currentWorkspace.my_role}
              isPlaying={playingId === item.id}
              onTogglePreview={() => toggleAudioPreview(item.id, item.url)}
            />
          ))}
        </div>
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a preview scrubber, not content; captions don't apply */}
      <audio ref={audioRef} onEnded={stopAudioPreview} className="hidden" />
    </div>
  )
}
