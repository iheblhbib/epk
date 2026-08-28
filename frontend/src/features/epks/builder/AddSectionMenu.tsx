import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ADDABLE_SECTION_ORDER, SECTION_TYPE_META, SINGLETON_SECTION_TYPES } from '@/features/epks/builder/sectionTypes'
import { useAddSection } from '@/features/epks/hooks/useEpkSections'
import type { EpkSection, SectionType } from '@/types'

export function AddSectionMenu({
  epkId,
  sections,
  onAdded,
}: {
  epkId: number
  sections: EpkSection[]
  onAdded: (sectionId: number) => void
}) {
  const addSection = useAddSection(epkId)
  const existingTypes = new Set(sections.map((section) => section.type))

  function handleAdd(type: SectionType) {
    addSection.mutate(
      { type },
      {
        onSuccess: (section) => {
          toast.success(`${SECTION_TYPE_META[type].label} section added`)
          onAdded(section.id)
        },
        onError: () => toast.error('Could not add this section'),
      }
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Add section
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {ADDABLE_SECTION_ORDER.map((type) => {
          const meta = SECTION_TYPE_META[type]
          const disabled = SINGLETON_SECTION_TYPES.includes(type) && existingTypes.has(type)
          return (
            <DropdownMenuItem key={type} disabled={disabled} onClick={() => handleAdd(type)}>
              <meta.icon className="size-4" />
              {meta.label}
              {disabled && <span className="ml-auto text-xs text-muted-foreground">Added</span>}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
