import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { SECTION_TYPE_META, SINGLETON_SECTION_TYPES } from '@/features/epks/builder/sectionTypes'
import {
  useDeleteSection,
  useDuplicateSection,
  useReorderSections,
  useUpdateSection,
} from '@/features/epks/hooks/useEpkSections'
import { cn } from '@/lib/utils'
import type { EpkSection } from '@/types'

function SortableSectionRow({
  section,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
  onToggleEnabled,
  isTogglePending,
  canEdit,
}: {
  section: EpkSection
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleEnabled: (checked: boolean) => void
  isTogglePending: boolean
  canEdit: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !canEdit,
  })
  const Icon = SECTION_TYPE_META[section.type].icon
  const canDuplicate = !SINGLETON_SECTION_TYPES.includes(section.type)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2',
        selected && 'border-primary ring-1 ring-primary',
        isDragging && 'opacity-60'
      )}
    >
      {canEdit && (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}

      <button type="button" onClick={onSelect} className="flex flex-1 items-center gap-2 overflow-hidden text-start">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-foreground">
          {section.title || SECTION_TYPE_META[section.type].label}
        </span>
      </button>

      {canEdit ? (
        <>
          <Switch checked={section.is_enabled} disabled={isTogglePending} onCheckedChange={onToggleEnabled} />

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!canDuplicate} onClick={onDuplicate}>
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        !section.is_enabled && (
          <span className="shrink-0 text-xs text-muted-foreground">Hidden</span>
        )
      )}
    </div>
  )
}

export function SectionList({
  epkId,
  sections,
  selectedSectionId,
  onSelectSection,
  canEdit,
}: {
  epkId: number
  sections: EpkSection[]
  selectedSectionId: number | null
  onSelectSection: (id: number) => void
  canEdit: boolean
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const updateSection = useUpdateSection(epkId)
  const duplicateSection = useDuplicateSection(epkId)
  const deleteSection = useDeleteSection(epkId)
  const reorderSections = useReorderSections(epkId)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const ordered = [...sections].sort((a, b) => a.position - b.position)
  const sectionToDelete = ordered.find((section) => section.id === pendingDeleteId) ?? null

  function handleDragEnd(event: DragEndEvent) {
    if (!canEdit) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = ordered.findIndex((section) => section.id === active.id)
    const overIndex = ordered.findIndex((section) => section.id === over.id)
    if (activeIndex === -1 || overIndex === -1) return

    const next = [...ordered]
    const [moved] = next.splice(activeIndex, 1)
    next.splice(overIndex, 0, moved)
    reorderSections.mutate(next.map((section) => section.id))
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered.map((section) => section.id)} strategy={verticalListSortingStrategy}>
          {ordered.map((section) => (
            <SortableSectionRow
              key={section.id}
              section={section}
              selected={section.id === selectedSectionId}
              onSelect={() => onSelectSection(section.id)}
              isTogglePending={updateSection.isPending}
              onToggleEnabled={(checked) =>
                updateSection.mutate({ sectionId: section.id, payload: { is_enabled: checked } })
              }
              onDuplicate={() =>
                duplicateSection.mutate(section.id, {
                  onSuccess: () => toast.success('Section duplicated'),
                  onError: () => toast.error('Could not duplicate this section'),
                })
              }
              onDelete={() => setPendingDeleteId(section.id)}
              canEdit={canEdit}
            />
          ))}
        </SortableContext>
      </DndContext>

      {ordered.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {canEdit ? 'No sections yet. Add one to start building this EPK.' : 'No sections yet.'}
        </p>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete section"
        description={
          sectionToDelete
            ? `"${sectionToDelete.title || SECTION_TYPE_META[sectionToDelete.type].label}" will be permanently removed from this EPK.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteSection.isPending}
        onConfirm={() => {
          if (pendingDeleteId === null) return
          deleteSection.mutate(pendingDeleteId, {
            onSuccess: () => {
              toast.success('Section deleted')
              setPendingDeleteId(null)
            },
            onError: () => toast.error('Could not delete this section'),
          })
        }}
      />
    </div>
  )
}
