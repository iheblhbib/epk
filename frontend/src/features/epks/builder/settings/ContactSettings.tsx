import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import type { ContactConfig, EpkSection } from '@/types'

export function ContactSettings({ epkId, section }: { epkId: number; section: EpkSection }) {
  const { t } = useTranslation()
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
      {field('booking_email', t('epkBuilder.contact.bookingEmail'), 'booking@example.com')}
      {field('press_email', t('epkBuilder.contact.pressEmail'), 'press@example.com')}
      {field('management_email', t('epkBuilder.contact.managementEmail'), 'management@example.com')}
      {field('website', t('epkBuilder.contact.website'), 'https://…')}
      {field('phone', t('epkBuilder.contact.phone'))}
      {field('address', t('epkBuilder.contact.address'))}

      <p className="text-xs text-muted-foreground">{t('epkBuilder.contact.privacyNote')}</p>

      <div className="flex items-center justify-between">
        <Label>{t('epkBuilder.contact.showPhonePublicly')}</Label>
        <Switch
          checked={config.show_phone ?? false}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, show_phone: checked }))}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>{t('epkBuilder.contact.showAddressPublicly')}</Label>
        <Switch
          checked={config.show_address ?? false}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, show_address: checked }))}
        />
      </div>
    </div>
  )
}
