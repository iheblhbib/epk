# Responsive per-device Hero settings (Height & Alignment) — Design

## Context

The EPK builder already has a device-preview switcher (Desktop / Tablet / Mobile) at
the top of `EpkBuilderPage.tsx`, but it's purely cosmetic: `deviceWidth` state only
picks a `max-w-*` class (`DEVICE_WIDTH_CLASS`) on the preview frame's wrapper `div`.
No section setting can currently vary by device — Hero's `height` and `alignment`
are single values applied identically everywhere.

The user wants an Elementor-style responsive-settings system: pick a device in that
same switcher, then edit a setting for *that device specifically* — e.g. Hero
`height` = Large on desktop, Medium on tablet, Small on mobile — with desktop acting
as the required default and tablet/mobile inheriting upward when not customized.

This spec covers exactly two fields on exactly one section (Hero: `height` and
`alignment`) as the first implementation of a reusable underlying mechanism. Every
other section/field stays untouched.

## Goals

- Reuse the existing global device switcher as the "which breakpoint am I editing"
  control — no per-field mini device-toggle UI (rejected alternative, see below).
- `height` and `alignment` on the Hero section become per-breakpoint: an object with
  a required `desktop` value and optional `tablet`/`mobile` overrides.
- Existing EPKs with a plain-string `height`/`alignment` keep working unmodified —
  no DB migration, no forced re-save. A legacy plain string behaves exactly as
  `{ desktop: <that value> }`.
- The builder's live preview and the real public page must both reflect the
  configured values correctly — the preview via a JS-level device check (see
  "Why two rendering paths" below), the public page via real CSS media queries so
  actual visitors on actual devices see the right value regardless of what the
  artist last happened to preview.
- When editing Tablet or Mobile and the field has no explicit override yet, the
  settings panel shows what it's inheriting (e.g. "Inherits from Desktop: Large")
  rather than silently editing blank state.

## Non-goals (explicitly out of scope for this pass)

- Any section other than Hero.
- Any Hero field other than `height` and `alignment` (headline/subtitle/description/
  images/overlay/CTA stay global).
- A per-field individual device-toggle UI (the Elementor screenshot's literal inline
  icon-per-field pattern) — rejected in favor of reusing the existing global switcher,
  per explicit user choice.
- Custom/configurable breakpoint widths — fixed at Tailwind's own defaults (below).

## Breakpoints

Match Tailwind's own default breakpoints, already used elsewhere in this codebase
(e.g. `PhotosSection`'s `grid-cols-2 sm:grid-cols-3`):

| Device  | Width          | Tailwind prefix |
|---------|----------------|------------------|
| Mobile  | < 640px        | (none — base)    |
| Tablet  | 640px – 1023px | `sm:`            |
| Desktop | ≥ 1024px       | `lg:`            |

## Data model

New generic shared type, plus named aliases for Hero's two field types (used
throughout the examples below instead of repeating the literal unions), all in
`frontend/src/types/index.ts`:

```typescript
export interface ResponsiveValue<T> {
  desktop: T
  tablet?: T | null
  mobile?: T | null
}

export type HeightValue = 'small' | 'medium' | 'large'
export type AlignValue = 'left' | 'center' | 'right'
```

`HeroConfig` (builder-authored, raw draft shape) widens `height`/`alignment` to
accept either the old plain value or the new object, so existing stored JSON keeps
parsing correctly:

```typescript
export interface HeroConfig {
  alignment?: AlignValue | ResponsiveValue<AlignValue>
  height?: HeightValue | ResponsiveValue<HeightValue>
  // ...unchanged fields below
}
```

`PublicHeroConfig` (resolved output the backend sends, and what both the public
renderer and — indirectly, see below — the builder preview consume) is **fully
resolved**: no optionality, no inheritance left for the consumer to figure out.

```typescript
export interface PublicHeroConfig {
  // ...unchanged fields
  alignment: { desktop: AlignValue; tablet: AlignValue; mobile: AlignValue }
  height: { desktop: HeightValue; tablet: HeightValue; mobile: HeightValue }
}
```

### Inheritance rule

`mobile` inherits `tablet` if unset; `tablet` inherits `desktop` if unset; `desktop`
is always present (it's required, and is the field's "default" the user already
knows from today's single-value control). This rule needs exactly one
implementation of the fallback logic per side (backend PHP, frontend TS) — see
below — both must produce identical results, since they're resolving the same
stored JSON.

## Backend changes

**`app/Enums/SectionType.php`** — `defaultConfig()`'s Hero case: `height`/`alignment`
defaults stay as plain strings (`'large'`, `'center'`) — a brand new Hero section has
no need to start with an object shape; the resolver treats a plain string exactly
like `{ desktop: value }` regardless, per the compatibility rule above.

**`app/Services/PublicSectionConfigResolver.php`** — the `SectionType::Hero` match
arm currently returns `'alignment' => $config['alignment'] ?? 'center'` and
`'height' => $config['height'] ?? 'large'` as plain passthroughs. Replace both with
a call to a new private helper:

```php
private function resolveResponsive(mixed $raw, string $default): array
{
    // A legacy plain string (or a totally missing key) becomes
    // ['desktop' => ..., 'tablet' => null, 'mobile' => null] before falling
    // through to the same inheritance logic as an already-object value.
    $value = is_array($raw) ? $raw : ['desktop' => $raw ?? $default];

    $desktop = $value['desktop'] ?? $default;
    $tablet = $value['tablet'] ?? $desktop;
    $mobile = $value['mobile'] ?? $tablet;

    return ['desktop' => $desktop, 'tablet' => $tablet, 'mobile' => $mobile];
}
```

used as:
```php
'alignment' => $this->resolveResponsive($config['alignment'] ?? null, 'center'),
'height' => $this->resolveResponsive($config['height'] ?? null, 'large'),
```

No other backend file needs to change — `StoreEpkSectionRequest`/`UpdateEpkSectionRequest`
validate `config` as an untyped array already (confirmed in the existing codebase),
so no validation-rule changes are required for the new shape.

## Frontend changes

### Shared inheritance helper (used by both the settings panel and the live preview)

New file `frontend/src/lib/responsiveValue.ts`:

```typescript
import type { ResponsiveValue } from '@/types'

export type DeviceWidth = 'desktop' | 'tablet' | 'mobile'

/** Normalizes a legacy plain value OR an already-responsive object into the
 * full { desktop, tablet, mobile } shape, applying the same
 * mobile-inherits-tablet-inherits-desktop rule as the backend resolver. */
export function normalizeResponsive<T>(raw: T | ResponsiveValue<T> | undefined, fallback: T): Required<ResponsiveValue<T>> {
  const value: ResponsiveValue<T> =
    raw && typeof raw === 'object' && 'desktop' in raw ? (raw as ResponsiveValue<T>) : { desktop: (raw as T) ?? fallback }

  const desktop = value.desktop ?? fallback
  const tablet = value.tablet ?? desktop
  const mobile = value.mobile ?? tablet

  return { desktop, tablet, mobile }
}

/** True when this device's value is not an explicit override -- i.e. it's
 * showing an inherited value from the next-larger breakpoint. Drives the
 * settings panel's "Inherits from Desktop: Large" indicator. */
export function isInherited<T>(raw: T | ResponsiveValue<T> | undefined, device: DeviceWidth): boolean {
  if (device === 'desktop') return false
  const value: ResponsiveValue<T> | undefined = raw && typeof raw === 'object' && 'desktop' in raw ? (raw as ResponsiveValue<T>) : undefined
  return value?.[device] == null
}
```

`DeviceWidth` moves here from being a private type inside `EpkBuilderPage.tsx`, so
it can be shared with `HeroSettings.tsx` and `LivePreview.tsx` without a circular
import; `EpkBuilderPage.tsx` imports it from this new module instead of declaring
its own copy.

### Threading `deviceWidth` down

- `EpkBuilderPage.tsx`: pass `deviceWidth` as a new prop to both `<LivePreview>` and
  `<SectionSettingsPanel>` (both already receive several props at that call site —
  see current lines ~178 and ~196).
- `SectionSettingsPanel.tsx`: accept `deviceWidth: DeviceWidth`, forward it only to
  `<HeroSettings>` (the one case that currently uses it; other section settings
  components' signatures are unaffected).
- `LivePreview.tsx`: accept `deviceWidth: DeviceWidth` at the top level, forward it
  only to `<HeroPreview>`.

### `HeroSettings.tsx`

For each of the two responsive fields, replace the direct `config.height` /
`config.alignment` read/write with:

```typescript
const heightValues = normalizeResponsive(config.height, 'large')
const heightInherited = isInherited(config.height, deviceWidth)
const currentHeight = heightValues[deviceWidth]

function setHeight(value: HeightValue) {
  setConfig((prev) => {
    const prevValues = normalizeResponsive(prev.height, 'large')
    return { ...prev, height: { ...prevValues, [deviceWidth]: value } }
  })
}
```

(same shape duplicated for `alignment`). The `<Select>` for each field:
- `value={currentHeight}` / `value={currentAlignment}`.
- `onValueChange` calls the setter above.
- When `deviceWidth !== 'desktop' && heightInherited` (or the alignment equivalent),
  render a small muted line under the label naming the breakpoint being inherited
  from (tablet inherits from desktop; mobile inherits from tablet, which may itself
  be inheriting from desktop) and its value — e.g. "Inherits from Desktop: Large".
  Exact translation string finalized in the implementation plan (see "Open items"),
  but the mechanism is: show which breakpoint's value is currently being inherited
  and what that value is.

### `LivePreview.tsx` — `HeroPreview`

Same `normalizeResponsive` call, keyed by the `deviceWidth` prop now passed in, to
pick `heightValues[deviceWidth]` / `alignmentValues[deviceWidth]` for the
`HEIGHT_CLASS`/`ALIGN_CLASS` lookups already used there today. This is a **JS-level**
per-device choice — see below for why.

### Why two separate rendering paths (builder preview vs. public page)

The builder's preview frame is a `max-w-*`-constrained `<div>` nested inside a full
desktop-width browser window (`DEVICE_WIDTH_CLASS` in `EpkBuilderPage.tsx`). Shrinking
a `<div>` with `max-width` does **not** make the real browser viewport smaller, so
Tailwind's `sm:`/`lg:` media queries never actually flip inside it — a real CSS
media-query-based approach would show the *desktop* value inside the shrunk preview
frame regardless of which device is "selected". The preview must therefore pick the
right value in JavaScript (`heightValues[deviceWidth]`, resolved above) rather than
relying on CSS breakpoints — this is a builder-only concern.

The **public page** (`sectionRenderers.tsx`'s `HeroSection`, what real visitors load
in their real, unconstrained browser) is the opposite: it must respond to the
visitor's actual viewport, so it needs genuine CSS media queries — Tailwind
`sm:`/`lg:` classes, not a JS check (there is no "selected device" concept there at
all, just whatever width the visitor's screen happens to be).

### `sectionRenderers.tsx` — `HeroSection` (public page)

`config.height`/`config.alignment` are now the fully-resolved
`{ desktop; tablet; mobile }` objects (per the backend resolver change above) — no
inheritance logic needed here, just per-breakpoint class lookup. Tailwind's JIT
scanner only picks up classes that appear as **complete literal strings** in source
(dynamic concatenation like `` `sm:${cls}` `` at runtime would not work, since
Tailwind never sees that exact string at build time) — so this needs three explicit
lookup tables instead of one, one per breakpoint prefix:

```typescript
const HEIGHT_CLASS_MOBILE: Record<HeightValue, string> = {
  small: 'min-h-[20rem]', medium: 'min-h-[28rem]', large: 'min-h-[38rem]',
}
const HEIGHT_CLASS_TABLET: Record<HeightValue, string> = {
  small: 'sm:min-h-[20rem]', medium: 'sm:min-h-[28rem]', large: 'sm:min-h-[38rem]',
}
const HEIGHT_CLASS_DESKTOP: Record<HeightValue, string> = {
  small: 'lg:min-h-[20rem]', medium: 'lg:min-h-[28rem]', large: 'lg:min-h-[38rem]',
}

const ALIGN_CLASS_MOBILE: Record<AlignValue, string> = {
  left: 'items-start text-start', center: 'items-center text-center', right: 'items-end text-end',
}
const ALIGN_CLASS_TABLET: Record<AlignValue, string> = {
  left: 'sm:items-start sm:text-start', center: 'sm:items-center sm:text-center', right: 'sm:items-end sm:text-end',
}
const ALIGN_CLASS_DESKTOP: Record<AlignValue, string> = {
  left: 'lg:items-start lg:text-start', center: 'lg:items-center lg:text-center', right: 'lg:items-end lg:text-end',
}
```

Both existing usage sites in `HeroSection` (the outer container at current line ~93-94,
and the inner content wrapper at current line ~104, which only uses `ALIGN_CLASS`)
combine all three breakpoint classes together, e.g.:

```tsx
cn(
  'relative flex flex-col justify-center gap-4 overflow-hidden px-6 py-16 sm:px-12',
  HEIGHT_CLASS_MOBILE[config.height.mobile],
  HEIGHT_CLASS_TABLET[config.height.tablet],
  HEIGHT_CLASS_DESKTOP[config.height.desktop],
  ALIGN_CLASS_MOBILE[config.alignment.mobile],
  ALIGN_CLASS_TABLET[config.alignment.tablet],
  ALIGN_CLASS_DESKTOP[config.alignment.desktop],
)
```

Tailwind's cascade (mobile-first, later breakpoints win when active) makes this the
correct, standard way to express "this property differs per breakpoint" without a
plugin or a safelist.

## Testing plan

**Backend (Pest)**, in `tests/Feature/Epk/PublicEpkTest.php`:
- A Hero section with a legacy plain-string `height`/`alignment` resolves to
  `{ desktop: <value>, tablet: <value>, mobile: <value> }` (all three equal — full
  inheritance from a single value).
- A Hero section with `height: { desktop: 'large', tablet: 'medium' }` (mobile
  omitted) resolves `mobile` to `'medium'` (inherited from tablet, not desktop).
- A Hero section with all three explicit resolves to exactly those three values.

**Frontend (Vitest)**, for `frontend/src/lib/responsiveValue.ts` directly (pure
functions, no rendering needed):
- `normalizeResponsive` on a plain legacy value, a partial object, and a fully
  explicit object.
- `isInherited` true for tablet/mobile when unset, false when set, always false for
  desktop.

**Manual/browser verification** (per this project's established practice — no
automated test touches actual rendered CSS breakpoints):
- In the builder: set Hero height to Large (desktop, default) → Medium (tablet) →
  Small (mobile); switch the device switcher between all three and confirm the
  preview frame changes accordingly; confirm the "inherits from" indicator appears
  before tablet/mobile are customized and disappears after.
- On the actual public page: resize the browser window across all three breakpoint
  thresholds and confirm the Hero section's height/alignment changes at the right
  pixel widths.

## Open items for the implementation plan

- Exact translation strings for the "Inherits from {device}: {value}" indicator, in
  all 7 locales.
- Whether `HeroPreview`'s existing `HEIGHT_CLASS`/`ALIGN_CLASS` constants (in
  `LivePreview.tsx`, separate from `sectionRenderers.tsx`'s copies) get renamed/kept
  as-is, since only the *lookup key* changes (now per-device), not the maps
  themselves.
