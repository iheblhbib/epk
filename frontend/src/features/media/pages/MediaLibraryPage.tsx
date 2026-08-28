import { FolderOpen, Search } from 'lucide-react'
import { useState } from 'react'
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

const TYPE_OPTIONS: { value: MediaType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'image', label: 'Images' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Documents' },
]

const SORT_OPTIONS: { value: string; sortBy: MediaListParams['sortBy']; sortDir: MediaListParams['sortDir']; label: string }[] = [
  { value: 'newest', sortBy: 'created_at', sortDir: 'desc', label: 'Newest first' },
  { value: 'oldest', sortBy: 'created_at', sortDir: 'asc', label: 'Oldest first' },
  { value: 'name_asc', sortBy: 'name', sortDir: 'asc', label: 'Name (A–Z)' },
  { value: 'name_desc', sortBy: 'name', sortDir: 'desc', label: 'Name (Z–A)' },
  { value: 'size_desc', sortBy: 'size', sortDir: 'desc', label: 'Largest first' },
  { value: 'size_asc', sortBy: 'size', sortDir: 'asc', label: 'Smallest first' },
]

// Select.Value only shows the selected item's label automatically when
// Select.Root is given this value->label map — otherwise (since these
// values differ from their display labels) it falls back to the raw value.
const TYPE_ITEMS = Object.fromEntries(TYPE_OPTIONS.map((option) => [option.value, option.label]))
const SORT_ITEMS = Object.fromEntries(SORT_OPTIONS.map((option) => [option.value, option.label]))

export function MediaLibraryPage() {
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<MediaType | 'all'>('all')
  const [sort, setSort] = useState('newest')

  const sortOption = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0]
  const canEdit = isEditorLevel(currentWorkspace?.my_role)

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
        title="No workspace yet"
        description="Create a workspace from the dashboard before uploading media."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Media Library</h1>
        <p className="text-sm text-muted-foreground">
          Photos, tracks, videos, and documents for {currentWorkspace.name}.
        </p>
      </div>

      {canEdit && <MediaUploadZone workspaceId={currentWorkspace.id} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            className="ps-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          items={TYPE_ITEMS}
          value={type}
          onValueChange={(value) => setType((value ?? 'all') as MediaType | 'all')}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={SORT_ITEMS} value={sort} onValueChange={(value) => setSort(value ?? 'newest')}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
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
          title={search || type !== 'all' ? 'No files match' : 'No files yet'}
          description={
            search || type !== 'all'
              ? 'Try a different search or filter.'
              : canEdit
                ? 'Upload photos, tracks, videos, or documents to get started.'
                : 'No files have been uploaded to this workspace yet.'
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
