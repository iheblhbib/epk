import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { ContactConfig, EpkSection } from '@/types'

export function ContactSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const config = section.config as ContactConfig
  const setConfig = useDraftSectionConfig<ContactConfig>(epkId, section)

  const field = (key: keyof ContactConfig, label: string, placeholder = '') => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        placeholder={placeholder}
        value={(config[key] as string) ?? ''}
        onChange={(event) => setConfig((prev) => ({ ...prev, [key]: event.target.value }))}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      {field('booking_email', 'Booking email', 'booking@example.com')}
      {field('press_email', 'Press email', 'press@example.com')}
      {field('management_email', 'Management email', 'management@example.com')}
      {field('website', 'Website', 'https://…')}
      {field('phone', 'Phone')}
      {field('address', 'Address')}

      <p className="text-xs text-muted-foreground">
        Private information is never shown on the public page unless you explicitly enable it below.
      </p>

      <div className="flex items-center justify-between">
        <Label>Show phone publicly</Label>
        <Switch
          checked={config.show_phone ?? false}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, show_phone: checked }))}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show address publicly</Label>
        <Switch
          checked={config.show_address ?? false}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, show_address: checked }))}
        />
      </div>
    </div>
  )
}
