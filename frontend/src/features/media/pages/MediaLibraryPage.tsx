import { FolderOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MediaCard } from '@/features/media/components/MediaCard'
import { MediaUploadZone } from '@/features/media/components/MediaUploadZone'
import { useMediaList } from '@/features/media/hooks/useMedia'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { isEditorLevel } from '@/lib/permissions'
import type { MediaListParams } from '@/api/media'
import type { MediaType } from '@/types'
import type { TFunction } from 'i18next'

const TYPE_VALUES: (MediaType | 'all')[] = ['all', 'image', 'audio', 'video', 'document']
const TYPE_LABEL_KEYS: Record<MediaType | 'all', string> = {
  all: 'media.types.all',
  image: 'media.types.image',
  audio: 'media.types.audio',
  video: 'media.types.video',
  document: 'media.types.document',
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

  const { data: media, isLoading } = useMediaList(currentWorkspace?.id, {
    search: search || undefined,
    type: type === 'all' ? undefined : type,
    sortBy: sortOption.sortBy,
    sortDir: sortOption.sortDir,
  })

  if (workspaceLoading) {
    return <CardGridSkeleton />
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
        <CardGridSkeleton />
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
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              workspaceId={currentWorkspace.id}
              myRole={currentWorkspace.my_role}
            />
          ))}
        </div>
      )}
    </div>
  )
}
