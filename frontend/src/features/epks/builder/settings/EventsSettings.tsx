import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GalleryItemRow } from '@/features/epks/builder/components/GalleryItemRow'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { moveItem } from '@/lib/arrayMove'
import type { EpkSection, EventItem, EventsConfig } from '@/types'

export function EventsSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const { t } = useTranslation()
  const config = section.config as EventsConfig
  const setConfig = useDraftSectionConfig<EventsConfig>(epkId, section)
  const events = config.events ?? []
  const typeItems = {
    headline: t('epkBuilder.events.typeHeadline'),
    support: t('epkBuilder.events.typeSupport'),
    festival: t('epkBuilder.events.typeFestival'),
    livestream: t('epkBuilder.events.typeLivestream'),
    other: t('epkBuilder.events.typeOther'),
  }

  const updateEvent = (index: number, patch: Partial<EventItem>) =>
    setConfig((prev) => ({
      ...prev,
      events: (prev.events ?? []).map((event, i) => (i === index ? { ...event, ...patch } : event)),
    }))

  return (
    <div className="space-y-3">
      <Label>{t('epkBuilder.sectionTypes.events')}</Label>
      {events.map((event, index) => (
        <GalleryItemRow
          key={index}
          canMoveUp={index > 0}
          canMoveDown={index < events.length - 1}
          onMoveUp={() => setConfig((prev) => ({ ...prev, events: moveItem(prev.events ?? [], index, 'up') }))}
          onMoveDown={() => setConfig((prev) => ({ ...prev, events: moveItem(prev.events ?? [], index, 'down') }))}
          onRemove={() => setConfig((prev) => ({ ...prev, events: (prev.events ?? []).filter((_, i) => i !== index) }))}
        >
          <div className="grid grid-cols-2 gap-2">
            <Select
              items={typeItems}
              value={event.type ?? 'headline'}
              onValueChange={(value) => updateEvent(index, { type: value as EventItem['type'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(typeItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={event.date ?? ''}
              onChange={(e) => updateEvent(index, { date: e.target.value || null })}
            />
          </div>
          <Input
            placeholder={t('epkBuilder.events.venuePlaceholder')}
            value={event.venue ?? ''}
            onChange={(e) => updateEvent(index, { venue: e.target.value })}
          />
          <Input
            placeholder={t('epkBuilder.events.cityPlaceholder')}
            value={event.city ?? ''}
            onChange={(e) => updateEvent(index, { city: e.target.value })}
          />
          <Input
            placeholder={t('epkBuilder.events.titlePlaceholder')}
            value={event.title ?? ''}
            onChange={(e) => updateEvent(index, { title: e.target.value })}
          />
          <Input
            placeholder={t('epkBuilder.events.ticketUrlPlaceholder')}
            value={event.ticket_url ?? ''}
            onChange={(e) => updateEvent(index, { ticket_url: e.target.value })}
          />
        </GalleryItemRow>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfig((prev) => ({ ...prev, events: [...(prev.events ?? []), { type: 'headline' }] }))}
      >
        <Plus className="size-4" />
        {t('epkBuilder.events.addEvent')}
      </Button>
    </div>
  )
}
