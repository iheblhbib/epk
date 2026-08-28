import { Label } from '@/components/ui/label'
import { MediaPickerMultiple } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { DownloadsConfig, EpkSection } from '@/types'

export function DownloadsSettings({
  epkId,
  workspaceId,
  section,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection
}) {
  const config = section.config as DownloadsConfig
  const setConfig = useDraftSectionConfig<DownloadsConfig>(epkId, section)

  return (
    <div className="space-y-1.5">
      <Label>Downloadable files</Label>
      <MediaPickerMultiple
        workspaceId={workspaceId}
        value={config.media_ids ?? []}
        onChange={(ids) => setConfig((prev) => ({ ...prev, media_ids: ids }))}
      />
    </div>
  )
}
