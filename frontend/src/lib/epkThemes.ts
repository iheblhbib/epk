import type { CSSProperties } from 'react'

export type ThemePreset = 'minimal' | 'dark' | 'editorial' | 'artist' | 'modern'
export type ThemeFont = 'sans' | 'serif' | 'display' | 'mono'
export type ButtonStyle = 'rounded' | 'pill' | 'square'
export type ThemeRadius = 'none' | 'small' | 'medium' | 'large'
export type ThemeSpacing = 'compact' | 'comfortable' | 'spacious'
export type HeaderStyle = 'centered' | 'left' | 'minimal'

/**
 * What an EPK stores in `custom_settings` — every axis optional, `null`/
 * absent means "inherit from the theme preset". Mirrors the backend's
 * UpdateEpkRequest validation exactly.
 */
export interface EpkCustomSettings {
  background_color?: string | null
  text_color?: string | null
  accent_color?: string | null
  font?: ThemeFont | null
  button_style?: ButtonStyle | null
  radius?: ThemeRadius | null
  spacing?: ThemeSpacing | null
  header_style?: HeaderStyle | null
}

interface ThemeTokens {
  background: string
  foreground: string
  muted: string
  accent: string
  accentForeground: string
  border: string
  font: ThemeFont
  buttonStyle: ButtonStyle
  radius: ThemeRadius
  spacing: ThemeSpacing
  headerStyle: HeaderStyle
}

export const THEME_PRESETS: Record<ThemePreset, { label: string; description: string; tokens: ThemeTokens }> = {
  minimal: {
    label: 'Minimal',
    description: 'Clean white background, understated type.',
    tokens: {
      background: '#ffffff',
      foreground: '#18181b',
      muted: '#71717a',
      accent: '#18181b',
      accentForeground: '#ffffff',
      border: '#e4e4e7',
      font: 'sans',
      buttonStyle: 'rounded',
      radius: 'medium',
      spacing: 'comfortable',
      headerStyle: 'centered',
    },
  },
  dark: {
    label: 'Dark',
    description: 'Moody black canvas with a bright accent.',
    tokens: {
      background: '#0a0a0a',
      foreground: '#fafafa',
      muted: '#a1a1aa',
      accent: '#8b7fff',
      accentForeground: '#0a0a0a',
      border: '#27272a',
      font: 'sans',
      buttonStyle: 'rounded',
      radius: 'medium',
      spacing: 'comfortable',
      headerStyle: 'centered',
    },
  },
  editorial: {
    label: 'Editorial',
    description: 'Serif type, magazine-style layout.',
    tokens: {
      background: '#faf8f5',
      foreground: '#1c1917',
      muted: '#78716c',
      accent: '#9f1239',
      accentForeground: '#faf8f5',
      border: '#e7e0d8',
      font: 'serif',
      buttonStyle: 'square',
      radius: 'none',
      spacing: 'spacious',
      headerStyle: 'left',
    },
  },
  artist: {
    label: 'Artist',
    description: 'Bold display type, vivid accent color.',
    tokens: {
      background: '#0f0a1e',
      foreground: '#f5f3ff',
      muted: '#c4b5fd',
      accent: '#f472b6',
      accentForeground: '#0f0a1e',
      border: '#3b2a5c',
      font: 'display',
      buttonStyle: 'pill',
      radius: 'large',
      spacing: 'comfortable',
      headerStyle: 'centered',
    },
  },
  modern: {
    label: 'Modern',
    description: 'Cool neutrals, geometric mono accents.',
    tokens: {
      background: '#f4f4f5',
      foreground: '#09090b',
      muted: '#52525b',
      accent: '#2563eb',
      accentForeground: '#f4f4f5',
      border: '#d4d4d8',
      font: 'mono',
      buttonStyle: 'square',
      radius: 'small',
      spacing: 'compact',
      headerStyle: 'left',
    },
  },
}

export const THEME_PRESET_ORDER: ThemePreset[] = ['minimal', 'dark', 'editorial', 'artist', 'modern']

const FONT_FAMILY: Record<ThemeFont, string> = {
  sans: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
  serif: "'Lora Variable', ui-serif, Georgia, serif",
  display: "'Space Grotesk Variable', ui-sans-serif, system-ui, sans-serif",
  mono: "'JetBrains Mono Variable', ui-monospace, monospace",
}

const RADIUS_VALUE: Record<ThemeRadius, string> = {
  none: '0px',
  small: '0.375rem',
  medium: '0.75rem',
  large: '1.5rem',
}

const SPACING_VALUE: Record<ThemeSpacing, string> = {
  compact: '2.5rem',
  comfortable: '4rem',
  spacious: '6rem',
}

/**
 * Layers an EPK's `custom_settings` overrides onto its base theme preset.
 * A missing/invalid preset id falls back to Minimal so a corrupted or
 * not-yet-set theme never breaks rendering.
 */
export function resolveTheme(preset: string | null | undefined, custom: EpkCustomSettings | null | undefined): ThemeTokens {
  const base = THEME_PRESETS[preset as ThemePreset]?.tokens ?? THEME_PRESETS.minimal.tokens

  return {
    background: custom?.background_color || base.background,
    foreground: custom?.text_color || base.foreground,
    muted: base.muted,
    accent: custom?.accent_color || base.accent,
    accentForeground: base.accentForeground,
    border: base.border,
    font: custom?.font || base.font,
    buttonStyle: custom?.button_style || base.buttonStyle,
    radius: custom?.radius || base.radius,
    spacing: custom?.spacing || base.spacing,
    headerStyle: custom?.header_style || base.headerStyle,
  }
}

/**
 * CSS custom properties a themed EPK container renders with. Section
 * components read these via Tailwind arbitrary-value utilities
 * (e.g. `bg-[var(--epk-bg)]`) rather than hardcoded theme classes, so one
 * container covers every preset/override combination.
 */
export function themeToCssVars(tokens: ThemeTokens): CSSProperties {
  return {
    '--epk-bg': tokens.background,
    '--epk-fg': tokens.foreground,
    '--epk-muted': tokens.muted,
    '--epk-accent': tokens.accent,
    '--epk-accent-fg': tokens.accentForeground,
    '--epk-border': tokens.border,
    '--epk-font': FONT_FAMILY[tokens.font],
    '--epk-radius': RADIUS_VALUE[tokens.radius],
    '--epk-section-gap': SPACING_VALUE[tokens.spacing],
  } as CSSProperties
}

export function buttonRadiusClass(buttonStyle: ButtonStyle): string {
  return buttonStyle === 'pill' ? 'rounded-full' : buttonStyle === 'square' ? 'rounded-none' : 'rounded-[var(--epk-radius)]'
}
