import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { EpkSection, HeroConfig } from '@/types'

const ALIGNMENT_ITEMS = { left: 'Left', center: 'Center', right: 'Right' }
const HEIGHT_ITEMS = { small: 'Small', medium: 'Medium', large: 'Large' }

export function HeroSettings({
  epkId,
  workspaceId,
  section,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection
}) {
  const config = section.config as HeroConfig
  const setConfig = useDraftSectionConfig<HeroConfig>(epkId, section)

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Headline</Label>
        <Input
          placeholder="Defaults to the artist's name"
          value={config.headline ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, headline: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Subtitle</Label>
        <Input
          value={config.subtitle ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, subtitle: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Short description</Label>
        <Textarea
          rows={3}
          value={config.description ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Profile image</Label>
        <MediaPickerSingle
          workspaceId={workspaceId}
          value={config.profile_media_id}
          onChange={(id) => setConfig((prev) => ({ ...prev, profile_media_id: id }))}
          type="image"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Background image</Label>
        <MediaPickerSingle
          workspaceId={workspaceId}
          value={config.background_media_id}
          onChange={(id) => setConfig((prev) => ({ ...prev, background_media_id: id }))}
          type="image"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Alignment</Label>
          <Select
            items={ALIGNMENT_ITEMS}
            value={config.alignment ?? 'center'}
            onValueChange={(value) => setConfig((prev) => ({ ...prev, alignment: value as HeroConfig['alignment'] }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ALIGNMENT_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Height</Label>
          <Select
            items={HEIGHT_ITEMS}
            value={config.height ?? 'large'}
            onValueChange={(value) => setConfig((prev) => ({ ...prev, height: value as HeroConfig['height'] }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(HEIGHT_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>Dark overlay</Label>
        <Switch
          checked={config.overlay ?? true}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, overlay: checked }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label>CTA button label</Label>
        <Input
          placeholder="Listen now"
          value={config.cta_label ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, cta_label: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>CTA URL</Label>
        <Input
          placeholder="https://…"
          value={config.cta_url ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, cta_url: event.target.value }))}
        />
      </div>
    </div>
  )
}
