import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/features/epks/builder/components/RichTextEditor'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { CustomConfig, EpkSection } from '@/types'

export function CustomSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const config = section.config as CustomConfig
  const setConfig = useDraftSectionConfig<CustomConfig>(epkId, section)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Heading</Label>
        <Input
          value={config.heading ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, heading: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Content</Label>
        <RichTextEditor
          value={config.html ?? ''}
          onChange={(html) => setConfig((prev) => ({ ...prev, html }))}
          placeholder="Write anything…"
        />
      </div>
    </div>
  )
}
