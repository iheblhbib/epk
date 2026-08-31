import { Check, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDraftEpkTheme } from '@/features/epks/builder/hooks/useDraftEpkTheme'
import {
  THEME_PRESET_ORDER,
  THEME_PRESETS,
  resolveTheme,
  type ButtonStyle,
  type EpkCustomSettings,
  type HeaderStyle,
  type ThemeFont,
  type ThemePreset,
  type ThemeRadius,
  type ThemeSpacing,
} from '@/lib/epkThemes'
import { cn } from '@/lib/utils'
import type { Epk } from '@/types'

function fontItems(t: TFunction): Record<ThemeFont, string> {
  return { sans: t('epkBuilder.theme.font.sans'), serif: t('epkBuilder.theme.font.serif'), display: t('epkBuilder.theme.font.display'), mono: t('epkBuilder.theme.font.mono') }
}
function buttonStyleItems(t: TFunction): Record<ButtonStyle, string> {
  return { rounded: t('epkBuilder.theme.buttonStyle.rounded'), pill: t('epkBuilder.theme.buttonStyle.pill'), square: t('epkBuilder.theme.buttonStyle.square') }
}
function radiusItems(t: TFunction): Record<ThemeRadius, string> {
  return { none: t('epkBuilder.theme.radius.none'), small: t('epkBuilder.theme.radius.small'), medium: t('epkBuilder.theme.radius.medium'), large: t('epkBuilder.theme.radius.large') }
}
function spacingItems(t: TFunction): Record<ThemeSpacing, string> {
  return { compact: t('epkBuilder.theme.spacing.compact'), comfortable: t('epkBuilder.theme.spacing.comfortable'), spacious: t('epkBuilder.theme.spacing.spacious') }
}
function headerStyleItems(t: TFunction): Record<HeaderStyle, string> {
  return { centered: t('epkBuilder.theme.headerStyle.centered'), left: t('epkBuilder.theme.headerStyle.left'), minimal: t('epkBuilder.theme.headerStyle.minimal') }
}

const INHERIT = '__inherit__'

function OverrideSelect<T extends string>({
  label,
  items,
  value,
  fallback,
  onChange,
  t,
}: {
  label: string
  items: Record<T, string>
  value: T | null | undefined
  fallback: T
  onChange: (value: T | null) => void
  t: TFunction
}) {
  const selectItems = { [INHERIT]: t('epkBuilder.theme.defaultOption', { value: items[fallback] }), ...items } as Record<string, string>

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        items={selectItems}
        value={value ?? INHERIT}
        onValueChange={(next) => onChange(next === INHERIT ? null : (next as T))}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(selectItems).map(([itemValue, itemLabel]) => (
            <SelectItem key={itemValue} value={itemValue}>
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ColorOverride({
  label,
  value,
  fallback,
  onChange,
  t,
}: {
  label: string
  value: string | null | undefined
  fallback: string
  onChange: (value: string | null) => void
  t: TFunction
}) {
  const current = value ?? fallback

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            {t('epkBuilder.theme.reset')}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={current}
          onChange={(event) => onChange(event.target.value)}
          className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <input
          type="text"
          value={current}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        />
      </div>
    </div>
  )
}

export function ThemePanel({ epk, canEdit }: { epk: Epk; canEdit: boolean }) {
  const { t } = useTranslation()
  const { setTheme, setCustomSettings } = useDraftEpkTheme(epk.id)
  const custom = (epk.custom_settings as EpkCustomSettings | null) ?? {}
  const preset = (epk.theme as ThemePreset) in THEME_PRESETS ? (epk.theme as ThemePreset) : 'minimal'
  const resolved = resolveTheme(epk.theme, custom)
  const fonts = fontItems(t)
  const buttonStyles = buttonStyleItems(t)
  const radii = radiusItems(t)
  const spacings = spacingItems(t)
  const headerStyles = headerStyleItems(t)

  return (
    <div className="space-y-6 p-4">
      {!canEdit && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t('common.viewOnlyAccess')}</p>
      )}
      {/* See SectionSettingsPanel for why this is a blanket overlay rather
          than gating every individual control. */}
      <div className={canEdit ? undefined : 'pointer-events-none opacity-60'} inert={!canEdit}>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('epkBuilder.theme.baseTheme')}</p>
        <div className="grid grid-cols-1 gap-2">
          {THEME_PRESET_ORDER.map((id) => {
            const themePreset = THEME_PRESETS[id]
            const isSelected = preset === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5 text-start transition-colors',
                  isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                )}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
                  style={{ background: themePreset.tokens.background, color: themePreset.tokens.foreground, border: `1px solid ${themePreset.tokens.border}` }}
                >
                  <span className="size-3 rounded-full" style={{ background: themePreset.tokens.accent }} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">{themePreset.label}</span>
                  <span className="block text-xs text-muted-foreground">{themePreset.description}</span>
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('epkBuilder.theme.customize')}</p>

        <ColorOverride
          label={t('epkBuilder.theme.backgroundColor')}
          value={custom.background_color}
          fallback={THEME_PRESETS[preset].tokens.background}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, background_color: value }))}
          t={t}
        />
        <ColorOverride
          label={t('epkBuilder.theme.textColor')}
          value={custom.text_color}
          fallback={THEME_PRESETS[preset].tokens.foreground}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, text_color: value }))}
          t={t}
        />
        <ColorOverride
          label={t('epkBuilder.theme.accentColor')}
          value={custom.accent_color}
          fallback={THEME_PRESETS[preset].tokens.accent}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, accent_color: value }))}
          t={t}
        />

        <OverrideSelect
          label={t('epkBuilder.theme.fontLabel')}
          items={fonts}
          value={custom.font}
          fallback={THEME_PRESETS[preset].tokens.font}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, font: value }))}
          t={t}
        />
        <OverrideSelect
          label={t('epkBuilder.theme.buttonStyleLabel')}
          items={buttonStyles}
          value={custom.button_style}
          fallback={THEME_PRESETS[preset].tokens.buttonStyle}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, button_style: value }))}
          t={t}
        />
        <OverrideSelect
          label={t('epkBuilder.theme.radiusLabel')}
          items={radii}
          value={custom.radius}
          fallback={THEME_PRESETS[preset].tokens.radius}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, radius: value }))}
          t={t}
        />
        <OverrideSelect
          label={t('epkBuilder.theme.spacingLabel')}
          items={spacings}
          value={custom.spacing}
          fallback={THEME_PRESETS[preset].tokens.spacing}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, spacing: value }))}
          t={t}
        />
        <OverrideSelect
          label={t('epkBuilder.theme.headerStyleLabel')}
          items={headerStyles}
          value={custom.header_style}
          fallback={THEME_PRESETS[preset].tokens.headerStyle}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, header_style: value }))}
          t={t}
        />
      </div>
      </div>

      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        {t('epkBuilder.theme.currently', {
          preset: THEME_PRESETS[preset].label,
          font: fonts[resolved.font],
          buttonStyle: buttonStyles[resolved.buttonStyle],
        })}
      </p>
    </div>
  )
}
