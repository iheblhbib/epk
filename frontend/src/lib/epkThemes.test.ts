import { describe, expect, it } from 'vitest'
import { buttonRadiusClass, resolveTheme, THEME_PRESETS, themeToCssVars } from '@/lib/epkThemes'

describe('resolveTheme', () => {
  it('resolves a known preset with no overrides to its own tokens', () => {
    const resolved = resolveTheme('dark', null)
    expect(resolved).toEqual(THEME_PRESETS.dark.tokens)
  })

  it('falls back to Minimal for a missing or unrecognized preset', () => {
    expect(resolveTheme(null, null)).toEqual(THEME_PRESETS.minimal.tokens)
    expect(resolveTheme('not-a-real-theme', null)).toEqual(THEME_PRESETS.minimal.tokens)
  })

  it('layers custom_settings overrides on top of the preset', () => {
    const resolved = resolveTheme('minimal', { accent_color: '#ff00aa', font: 'serif' })
    expect(resolved.accent).toBe('#ff00aa')
    expect(resolved.font).toBe('serif')
    // Untouched axes still come from the preset.
    expect(resolved.background).toBe(THEME_PRESETS.minimal.tokens.background)
    expect(resolved.buttonStyle).toBe(THEME_PRESETS.minimal.tokens.buttonStyle)
  })

  it('treats null override values as "inherit", not as an explicit empty value', () => {
    const resolved = resolveTheme('editorial', { accent_color: null, font: null })
    expect(resolved.accent).toBe(THEME_PRESETS.editorial.tokens.accent)
    expect(resolved.font).toBe(THEME_PRESETS.editorial.tokens.font)
  })
})

describe('themeToCssVars', () => {
  it('maps every resolved token to its CSS custom property', () => {
    const vars = themeToCssVars(resolveTheme('dark', null)) as Record<string, string>
    expect(vars['--epk-bg']).toBe(THEME_PRESETS.dark.tokens.background)
    expect(vars['--epk-fg']).toBe(THEME_PRESETS.dark.tokens.foreground)
    expect(vars['--epk-accent']).toBe(THEME_PRESETS.dark.tokens.accent)
    expect(vars['--epk-font']).toContain('Inter Variable')
    expect(vars['--epk-radius']).toBe('0.75rem')
  })
})

describe('buttonRadiusClass', () => {
  it('maps pill and square to fixed utility classes', () => {
    expect(buttonRadiusClass('pill')).toBe('rounded-full')
    expect(buttonRadiusClass('square')).toBe('rounded-none')
  })

  it('maps rounded to the theme-variable radius', () => {
    expect(buttonRadiusClass('rounded')).toBe('rounded-[var(--epk-radius)]')
  })
})
