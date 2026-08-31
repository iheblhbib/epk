import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const addSection = useAddSection(epkId)
  const existingTypes = new Set(sections.map((section) => section.type))

  function handleAdd(type: SectionType) {
    addSection.mutate(
      { type },
      {
        onSuccess: (section) => {
          toast.success(t('epkBuilder.sectionAdded', { section: t(SECTION_TYPE_META[type].labelKey) }))
          onAdded(section.id)
        },
        onError: () => toast.error(t('epkBuilder.sectionAddError')),
      }
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        {t('epkBuilder.addSection')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {ADDABLE_SECTION_ORDER.map((type) => {
          const meta = SECTION_TYPE_META[type]
          const disabled = SINGLETON_SECTION_TYPES.includes(type) && existingTypes.has(type)
          return (
            <DropdownMenuItem key={type} disabled={disabled} onClick={() => handleAdd(type)}>
              <meta.icon className="size-4" />
              {t(meta.labelKey)}
              {disabled && <span className="ml-auto text-xs text-muted-foreground">{t('epkBuilder.added')}</span>}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
