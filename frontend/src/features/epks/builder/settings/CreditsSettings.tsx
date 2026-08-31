import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { CreditsConfig, EpkSection } from '@/types'

export function CreditsSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const { t } = useTranslation()
  const config = section.config as CreditsConfig
  const setConfig = useDraftSectionConfig<CreditsConfig>(epkId, section)
  const items = config.items ?? []

  return (
    <div className="space-y-3">
      <Label>{t('epkBuilder.sectionTypes.credits')}</Label>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder={t('epkBuilder.credits.rolePlaceholder')}
            value={item.role}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                items: (prev.items ?? []).map((entry, i) =>
                  i === index ? { ...entry, role: event.target.value } : entry
                ),
              }))
            }
          />
          <Input
            placeholder={t('epkBuilder.credits.namePlaceholder')}
            value={item.name}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                items: (prev.items ?? []).map((entry, i) =>
                  i === index ? { ...entry, name: event.target.value } : entry
                ),
              }))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setConfig((prev) => ({ ...prev, items: (prev.items ?? []).filter((_, i) => i !== index) }))
            }
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, items: [...(prev.items ?? []), { role: '', name: '' }] }))}
      >
        <Plus className="size-4" />
        {t('epkBuilder.credits.addCredit')}
      </Button>
    </div>
  )
}
