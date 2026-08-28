import { Check, RotateCcw } from 'lucide-react'
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

const FONT_ITEMS: Record<ThemeFont, string> = { sans: 'Sans', serif: 'Serif', display: 'Display', mono: 'Mono' }
const BUTTON_STYLE_ITEMS: Record<ButtonStyle, string> = { rounded: 'Rounded', pill: 'Pill', square: 'Square' }
const RADIUS_ITEMS: Record<ThemeRadius, string> = { none: 'None', small: 'Small', medium: 'Medium', large: 'Large' }
const SPACING_ITEMS: Record<ThemeSpacing, string> = { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }
const HEADER_STYLE_ITEMS: Record<HeaderStyle, string> = { centered: 'Centered', left: 'Left-aligned', minimal: 'Minimal' }

const INHERIT = '__inherit__'

function OverrideSelect<T extends string>({
  label,
  items,
  value,
  fallback,
  onChange,
}: {
  label: string
  items: Record<T, string>
  value: T | null | undefined
  fallback: T
  onChange: (value: T | null) => void
}) {
  const selectItems = { [INHERIT]: `Default (${items[fallback]})`, ...items } as Record<string, string>

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
}: {
  label: string
  value: string | null | undefined
  fallback: string
  onChange: (value: string | null) => void
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
            Reset
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
  const { setTheme, setCustomSettings } = useDraftEpkTheme(epk.id)
  const custom = (epk.custom_settings as EpkCustomSettings | null) ?? {}
  const preset = (epk.theme as ThemePreset) in THEME_PRESETS ? (epk.theme as ThemePreset) : 'minimal'
  const resolved = resolveTheme(epk.theme, custom)

  return (
    <div className="space-y-6 p-4">
      {!canEdit && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          You have view-only access to this workspace.
        </p>
      )}
      {/* See SectionSettingsPanel for why this is a blanket overlay rather
          than gating every individual control. */}
      <div className={canEdit ? undefined : 'pointer-events-none opacity-60'} inert={!canEdit}>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Base theme</p>
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
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Customize</p>

        <ColorOverride
          label="Background color"
          value={custom.background_color}
          fallback={THEME_PRESETS[preset].tokens.background}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, background_color: value }))}
        />
        <ColorOverride
          label="Text color"
          value={custom.text_color}
          fallback={THEME_PRESETS[preset].tokens.foreground}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, text_color: value }))}
        />
        <ColorOverride
          label="Accent color"
          value={custom.accent_color}
          fallback={THEME_PRESETS[preset].tokens.accent}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, accent_color: value }))}
        />

        <OverrideSelect
          label="Font"
          items={FONT_ITEMS}
          value={custom.font}
          fallback={THEME_PRESETS[preset].tokens.font}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, font: value }))}
        />
        <OverrideSelect
          label="Button style"
          items={BUTTON_STYLE_ITEMS}
          value={custom.button_style}
          fallback={THEME_PRESETS[preset].tokens.buttonStyle}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, button_style: value }))}
        />
        <OverrideSelect
          label="Corner radius"
          items={RADIUS_ITEMS}
          value={custom.radius}
          fallback={THEME_PRESETS[preset].tokens.radius}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, radius: value }))}
        />
        <OverrideSelect
          label="Section spacing"
          items={SPACING_ITEMS}
          value={custom.spacing}
          fallback={THEME_PRESETS[preset].tokens.spacing}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, spacing: value }))}
        />
        <OverrideSelect
          label="Header style"
          items={HEADER_STYLE_ITEMS}
          value={custom.header_style}
          fallback={THEME_PRESETS[preset].tokens.headerStyle}
          onChange={(value) => setCustomSettings((prev) => ({ ...prev, header_style: value }))}
        />
      </div>
      </div>

      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        Currently: {THEME_PRESETS[preset].label} · {FONT_ITEMS[resolved.font]} · {BUTTON_STYLE_ITEMS[resolved.buttonStyle]} buttons
      </p>
    </div>
  )
}
