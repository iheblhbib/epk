# Responsive per-device Hero settings (Height & Alignment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hero section's Height and Alignment settings responsive — a
required desktop value plus optional tablet/mobile overrides that inherit upward
when unset, editable by picking a device in the builder's existing device-preview
switcher.

**Architecture:** A new generic `ResponsiveValue<T>` shape (`{ desktop, tablet?,
mobile? }`) stored in the Hero section's JSON config. A shared frontend helper
(`normalizeResponsive`/`isInherited`) resolves inheritance identically wherever the
builder needs a specific device's value; a mirrored PHP helper does the same for the
resolved public-page output. The builder's existing `deviceWidth` preview state
becomes the single source of truth for "which breakpoint is being edited/previewed"
everywhere in the builder. The public page instead uses real Tailwind `sm:`/`lg:`
classes so it responds to a visitor's actual viewport.

**Tech Stack:** Laravel 12/Pest (backend), React 19/TypeScript/Vitest/Tailwind v4
(frontend) — matches the rest of this repo, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-responsive-hero-settings-design.md`

## Global Constraints

- Only the Hero section's `height` and `alignment` fields change. No other section,
  and no other Hero field, is touched.
- No per-field individual device-toggle UI — the existing global device switcher in
  `EpkBuilderPage.tsx` is the only editing-context control.
- Breakpoints are fixed at Tailwind's own defaults: mobile < 640px, tablet
  640–1023px (`sm:`), desktop ≥ 1024px (`lg:`). Not configurable.
- Backward compatible with every existing stored EPK: a legacy plain-string
  `height`/`alignment` must keep resolving and rendering exactly as it does today.
  No database migration.
- New i18n strings need entries in all 7 locale files (en/fr/es/pt/de/ar/zh) — this
  project's established discipline (see `frontend/src/i18n/locales/*.json`).
- The `HeroSettings`/`LivePreview`/`SectionSettingsPanel`/`EpkBuilderPage` components
  have no existing automated test coverage (no RTL harness, no MSW handlers for the
  authenticated builder). Per this project's established practice throughout this
  session, changes to these components are verified by live interaction in the
  browser (log in as `demo@korax.test` / `password`, open a Hero section in the
  builder, switch devices, inspect) rather than by writing a new RTL test harness
  from scratch — that harness would be a disproportionate expansion of scope for a
  two-field feature. Pure, isolated logic (the responsive-value helpers, the backend
  resolver) still gets real automated tests via TDD.
- Every task ends with: relevant automated tests green, `vendor/bin/pint --test`
  (backend tasks) or `npx tsc -b --noEmit` + `npx oxlint <changed files>` (frontend
  tasks) clean, and a commit.

---

### Task 1: Shared responsive-value types and pure helper functions

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/responsiveValue.ts`
- Create: `frontend/src/lib/responsiveValue.test.ts`

**Interfaces:**
- Produces: `ResponsiveValue<T>`, `HeightValue`, `AlignValue` (exported from
  `@/types`); `DeviceWidth`, `ResolvedResponsiveValue<T>`,
  `normalizeResponsive<T>(raw, fallback)`, `isInherited<T>(raw, device)` (exported
  from `@/lib/responsiveValue`) — every later task imports these exact names.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/responsiveValue.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { isInherited, normalizeResponsive } from '@/lib/responsiveValue'

describe('normalizeResponsive', () => {
  it('treats a plain legacy value as desktop-only, inheriting to tablet and mobile', () => {
    expect(normalizeResponsive('large', 'large')).toEqual({ desktop: 'large', tablet: 'large', mobile: 'large' })
  })

  it('treats a missing value as the given fallback', () => {
    expect(normalizeResponsive(undefined, 'large')).toEqual({ desktop: 'large', tablet: 'large', mobile: 'large' })
  })

  it('lets tablet inherit desktop when tablet is unset', () => {
    expect(normalizeResponsive({ desktop: 'large' }, 'large')).toEqual({
      desktop: 'large',
      tablet: 'large',
      mobile: 'large',
    })
  })

  it('lets mobile inherit tablet (not desktop) when only mobile is unset', () => {
    expect(normalizeResponsive({ desktop: 'large', tablet: 'medium' }, 'large')).toEqual({
      desktop: 'large',
      tablet: 'medium',
      mobile: 'medium',
    })
  })

  it('keeps every explicit value when all three are set', () => {
    expect(normalizeResponsive({ desktop: 'large', tablet: 'medium', mobile: 'small' }, 'large')).toEqual({
      desktop: 'large',
      tablet: 'medium',
      mobile: 'small',
    })
  })
})

describe('isInherited', () => {
  it('is always false for desktop', () => {
    expect(isInherited(undefined, 'desktop')).toBe(false)
    expect(isInherited({ desktop: 'large' }, 'desktop')).toBe(false)
  })

  it('is true for tablet/mobile when the value is a legacy plain string', () => {
    expect(isInherited('large', 'tablet')).toBe(true)
    expect(isInherited('large', 'mobile')).toBe(true)
  })

  it('is true for tablet when the responsive object has no tablet key', () => {
    expect(isInherited({ desktop: 'large' }, 'tablet')).toBe(true)
  })

  it('is false for tablet when the responsive object has an explicit tablet value', () => {
    expect(isInherited({ desktop: 'large', tablet: 'medium' }, 'tablet')).toBe(false)
  })

  it('is true for mobile when only desktop and tablet are set', () => {
    expect(isInherited({ desktop: 'large', tablet: 'medium' }, 'mobile')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/responsiveValue.test.ts`
Expected: FAIL — `Cannot find module '@/lib/responsiveValue'` (the module doesn't exist yet).

- [ ] **Step 3: Add the types**

In `frontend/src/types/index.ts`, find `export interface HeroConfig {` and the
`export interface PublicHeroConfig {` block (both already exist). Add just above
`HeroConfig`:

```typescript
export interface ResponsiveValue<T> {
  desktop: T
  tablet?: T | null
  mobile?: T | null
}

export type HeightValue = 'small' | 'medium' | 'large'
export type AlignValue = 'left' | 'center' | 'right'
```

Then change these two lines inside `HeroConfig`:

```typescript
  alignment?: 'left' | 'center' | 'right'
  height?: 'small' | 'medium' | 'large'
```

to:

```typescript
  alignment?: AlignValue | ResponsiveValue<AlignValue>
  height?: HeightValue | ResponsiveValue<HeightValue>
```

And these two lines inside `PublicHeroConfig`:

```typescript
  alignment: 'left' | 'center' | 'right'
  height: 'small' | 'medium' | 'large'
```

to:

```typescript
  alignment: { desktop: AlignValue; tablet: AlignValue; mobile: AlignValue }
  height: { desktop: HeightValue; tablet: HeightValue; mobile: HeightValue }
```

- [ ] **Step 4: Write the implementation**

Create `frontend/src/lib/responsiveValue.ts`:

```typescript
import type { ResponsiveValue } from '@/types'

export type DeviceWidth = 'desktop' | 'tablet' | 'mobile'

/** The fully-resolved shape normalizeResponsive() always returns -- unlike
 * ResponsiveValue<T> itself, none of these three keys can be null/missing. */
export interface ResolvedResponsiveValue<T> {
  desktop: T
  tablet: T
  mobile: T
}

function asResponsiveObject<T>(raw: T | ResponsiveValue<T> | undefined): ResponsiveValue<T> | undefined {
  return raw !== null && typeof raw === 'object' && 'desktop' in raw ? (raw as ResponsiveValue<T>) : undefined
}

/**
 * Normalizes a legacy plain value OR an already-responsive object into the
 * full { desktop, tablet, mobile } shape, applying the same
 * mobile-inherits-tablet-inherits-desktop rule as the backend resolver
 * (PublicSectionConfigResolver::resolveResponsive()) -- both must agree,
 * since they resolve the same stored JSON.
 */
export function normalizeResponsive<T>(
  raw: T | ResponsiveValue<T> | undefined,
  fallback: T
): ResolvedResponsiveValue<T> {
  const asObject = asResponsiveObject(raw)
  const value: ResponsiveValue<T> = asObject ?? { desktop: (raw as T | undefined) ?? fallback }

  const desktop = value.desktop ?? fallback
  const tablet = value.tablet ?? desktop
  const mobile = value.mobile ?? tablet

  return { desktop, tablet, mobile }
}

/**
 * True when this device's value is not an explicit override -- i.e. it's
 * showing a value inherited from the next-larger breakpoint (tablet inherits
 * desktop; mobile inherits tablet). Always false for desktop, since desktop
 * has no larger breakpoint to inherit from. Drives the settings panel's
 * "Inherits from Desktop: Large" indicator.
 */
export function isInherited<T>(raw: T | ResponsiveValue<T> | undefined, device: DeviceWidth): boolean {
  if (device === 'desktop') return false
  const asObject = asResponsiveObject(raw)
  if (!asObject) return true // a legacy plain value (or nothing) has no explicit tablet/mobile override
  return asObject[device] == null
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/responsiveValue.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Verify the rest of the frontend still typechecks/lints**

Run: `cd frontend && npx tsc -b --noEmit && npx oxlint src/types/index.ts src/lib/responsiveValue.ts src/lib/responsiveValue.test.ts`
Expected: no errors. (Other files that reference `HeroConfig`/`PublicHeroConfig`
will start failing to typecheck once their `height`/`alignment` usage no longer
matches the widened type — that's expected and fixed in Tasks 3–5. If `tsc` reports
errors in `HeroSettings.tsx`, `LivePreview.tsx`, or `sectionRenderers.tsx` at this
point, that's expected; do not fix them in this task.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/responsiveValue.ts frontend/src/lib/responsiveValue.test.ts
git commit -m "Add ResponsiveValue<T> type and normalize/isInherited helpers"
```

---

### Task 2: Backend resolver support for responsive Hero height/alignment

**Files:**
- Modify: `backend/app/Services/PublicSectionConfigResolver.php`
- Modify: `backend/tests/Feature/Epk/PublicEpkTest.php`

**Interfaces:**
- Consumes: nothing from Task 1 (backend and frontend resolve independently against
  the same JSON shape).
- Produces: `PublicSectionConfigResolver`'s Hero case now returns
  `'height' => ['desktop' => ..., 'tablet' => ..., 'mobile' => ...]` and
  `'alignment' => ['desktop' => ..., 'tablet' => ..., 'mobile' => ...]` (previously
  plain strings) — Task 5's public-page renderer consumes this exact shape.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/Feature/Epk/PublicEpkTest.php`, add (near the other Hero-focused
tests — search for `SectionType::Hero` to find a good spot):

```php
it('resolves a legacy plain-string hero height/alignment as fully inherited from desktop', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['headline' => 'Test', 'height' => 'small', 'alignment' => 'left'],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.height', ['desktop' => 'small', 'tablet' => 'small', 'mobile' => 'small']);
    $response->assertJsonPath('data.sections.0.config.alignment', ['desktop' => 'left', 'tablet' => 'left', 'mobile' => 'left']);
});

it('lets a hero section\'s mobile height inherit from tablet, not desktop, when only mobile is unset', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['headline' => 'Test', 'height' => ['desktop' => 'large', 'tablet' => 'medium']],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.height', ['desktop' => 'large', 'tablet' => 'medium', 'mobile' => 'medium']);
});

it('keeps every explicit per-device hero height/alignment value when all three are set', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => [
            'headline' => 'Test',
            'height' => ['desktop' => 'large', 'tablet' => 'medium', 'mobile' => 'small'],
            'alignment' => ['desktop' => 'center', 'tablet' => 'left', 'mobile' => 'right'],
        ],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.height', ['desktop' => 'large', 'tablet' => 'medium', 'mobile' => 'small']);
    $response->assertJsonPath('data.sections.0.config.alignment', ['desktop' => 'center', 'tablet' => 'left', 'mobile' => 'right']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter="hero height/alignment|hero section's mobile height|per-device hero height"`
Expected: FAIL — `data.sections.0.config.height` is currently the plain string
`'small'`/`'large'`, not an array, so `assertJsonPath` fails the comparison.

- [ ] **Step 3: Write the implementation**

In `backend/app/Services/PublicSectionConfigResolver.php`, find the
`SectionType::Hero => [` match arm (near the top of `resolve()`). Change:

```php
                'alignment' => $config['alignment'] ?? 'center',
                'height' => $config['height'] ?? 'large',
```

to:

```php
                'alignment' => $this->resolveResponsive($config['alignment'] ?? null, 'center'),
                'height' => $this->resolveResponsive($config['height'] ?? null, 'large'),
```

Then add this new private method (near `urlFor()`/`mediaFor()` at the bottom of the
class):

```php
    /**
     * Normalizes a Hero field that may be stored as a legacy plain string OR
     * as a { desktop, tablet?, mobile? } object into a fully-resolved
     * { desktop, tablet, mobile } array -- mobile inherits tablet, tablet
     * inherits desktop, when unset. Mirrors the frontend's
     * normalizeResponsive() (frontend/src/lib/responsiveValue.ts); both must
     * agree, since they resolve the same stored JSON.
     *
     * @return array{desktop: string, tablet: string, mobile: string}
     */
    private function resolveResponsive(mixed $raw, string $default): array
    {
        $value = is_array($raw) ? $raw : ['desktop' => $raw ?? $default];

        $desktop = $value['desktop'] ?? $default;
        $tablet = $value['tablet'] ?? $desktop;
        $mobile = $value['mobile'] ?? $tablet;

        return ['desktop' => $desktop, 'tablet' => $tablet, 'mobile' => $mobile];
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter="hero height/alignment|hero section's mobile height|per-device hero height"`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full backend suite and pint**

Run: `cd backend && php artisan test && vendor/bin/pint --test`
Expected: all tests pass (no other test currently asserts Hero's `height`/`alignment`
as a plain string — if one does, update it to expect the new object shape), pint
clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/PublicSectionConfigResolver.php backend/tests/Feature/Epk/PublicEpkTest.php
git commit -m "Resolve Hero height/alignment as per-device desktop/tablet/mobile values"
```

---

### Task 3: HeroSettings per-device editing UI, wiring, and i18n

**Files:**
- Modify: `frontend/src/features/epks/builder/EpkBuilderPage.tsx`
- Modify: `frontend/src/features/epks/builder/SectionSettingsPanel.tsx`
- Modify: `frontend/src/features/epks/builder/settings/HeroSettings.tsx`
- Modify: `frontend/src/i18n/locales/en.json`, `fr.json`, `es.json`, `pt.json`, `de.json`, `ar.json`, `zh.json`

**Interfaces:**
- Consumes: `DeviceWidth`, `normalizeResponsive`, `isInherited` from
  `@/lib/responsiveValue` (Task 1).
- Produces: `SectionSettingsPanel` now requires a `deviceWidth: DeviceWidth` prop
  (Task 4 does the same for `LivePreview` independently — both read from the same
  `EpkBuilderPage` state).

- [ ] **Step 1: Move `DeviceWidth` out of `EpkBuilderPage.tsx` and thread it down**

In `frontend/src/features/epks/builder/EpkBuilderPage.tsx`:

Remove this local declaration (currently near the top of the file, right after the
imports):

```typescript
type DeviceWidth = 'desktop' | 'tablet' | 'mobile'
```

Add an import instead:

```typescript
import type { DeviceWidth } from '@/lib/responsiveValue'
```

Find the `<SectionSettingsPanel` call (currently passing `epkId`, `workspaceId`,
`section={selectedSection}`, `canEdit`) and add `deviceWidth={deviceWidth}` as a new
prop:

```tsx
              <SectionSettingsPanel
                epkId={epkId}
                workspaceId={epk.workspace_id}
                section={selectedSection}
                canEdit={canEdit}
                deviceWidth={deviceWidth}
              />
```

- [ ] **Step 2: Forward `deviceWidth` through `SectionSettingsPanel.tsx`**

In `frontend/src/features/epks/builder/SectionSettingsPanel.tsx`:

Add the import:

```typescript
import type { DeviceWidth } from '@/lib/responsiveValue'
```

Change the component's current signature:

```typescript
export function SectionSettingsPanel({
  epkId,
  workspaceId,
  section,
  canEdit,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection | null
  canEdit: boolean
}) {
```

to:

```typescript
export function SectionSettingsPanel({
  epkId,
  workspaceId,
  section,
  canEdit,
  deviceWidth,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection | null
  canEdit: boolean
  deviceWidth: DeviceWidth
}) {
```

Then find this line inside the section-type switch (currently passing exactly
these three props to `HeroSettings`):

```tsx
                return <HeroSettings epkId={epkId} workspaceId={workspaceId} section={section} />
```

and add the new prop:

```tsx
                return <HeroSettings epkId={epkId} workspaceId={workspaceId} section={section} deviceWidth={deviceWidth} />
```

(Every other section-settings case in that same switch statement is unaffected —
don't add `deviceWidth` to any of them.)

- [ ] **Step 3: Update `HeroSettings.tsx` to edit per-device values**

Replace the full contents of `frontend/src/features/epks/builder/settings/HeroSettings.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MediaPickerSingle } from '@/features/epks/builder/components/MediaPicker'
import { useDraftSectionConfig } from '@/features/epks/builder/hooks/useDraftSectionConfig'
import { isInherited, normalizeResponsive, type DeviceWidth } from '@/lib/responsiveValue'
import type { AlignValue, EpkSection, HeightValue, HeroConfig } from '@/types'

export function HeroSettings({
  epkId,
  workspaceId,
  section,
  deviceWidth,
}: {
  epkId: number
  workspaceId: number
  section: EpkSection
  deviceWidth: DeviceWidth
}) {
  const { t } = useTranslation()
  const config = section.config as HeroConfig
  const setConfig = useDraftSectionConfig<HeroConfig>(epkId, section)
  const alignmentItems = {
    left: t('epkBuilder.hero.alignmentLeft'),
    center: t('epkBuilder.hero.alignmentCenter'),
    right: t('epkBuilder.hero.alignmentRight'),
  }
  const heightItems = {
    small: t('epkBuilder.hero.heightSmall'),
    medium: t('epkBuilder.hero.heightMedium'),
    large: t('epkBuilder.hero.heightLarge'),
  }

  const alignmentValues = normalizeResponsive<AlignValue>(config.alignment, 'center')
  const heightValues = normalizeResponsive<HeightValue>(config.height, 'large')
  const alignmentInherited = isInherited(config.alignment, deviceWidth)
  const heightInherited = isInherited(config.height, deviceWidth)

  function setAlignment(value: AlignValue) {
    setConfig((prev) => ({
      ...prev,
      alignment: { ...normalizeResponsive<AlignValue>(prev.alignment, 'center'), [deviceWidth]: value },
    }))
  }

  function setHeight(value: HeightValue) {
    setConfig((prev) => ({
      ...prev,
      height: { ...normalizeResponsive<HeightValue>(prev.height, 'large'), [deviceWidth]: value },
    }))
  }

  // Tablet inherits from desktop; mobile inherits from tablet (which may
  // itself be inheriting from desktop) -- always name the *immediate*
  // parent breakpoint, matching normalizeResponsive()'s own fallback chain.
  const inheritsFromDevice = deviceWidth === 'mobile' ? 'tablet' : 'desktop'
  const inheritsFromLabel = t(`epkBuilder.device.${inheritsFromDevice}Short`)

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.headline')}</Label>
        <Input
          placeholder={t('epkBuilder.hero.headlinePlaceholder')}
          value={config.headline ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, headline: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.subtitle')}</Label>
        <Input
          value={config.subtitle ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, subtitle: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.description')}</Label>
        <Textarea
          rows={3}
          value={config.description ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.profileImage')}</Label>
        <MediaPickerSingle
          workspaceId={workspaceId}
          value={config.profile_media_id}
          onChange={(id) => setConfig((prev) => ({ ...prev, profile_media_id: id }))}
          type="image"
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.backgroundImage')}</Label>
        <MediaPickerSingle
          workspaceId={workspaceId}
          value={config.background_media_id}
          onChange={(id) => setConfig((prev) => ({ ...prev, background_media_id: id }))}
          type="image"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('epkBuilder.hero.alignment')}</Label>
          <Select
            items={alignmentItems}
            value={alignmentValues[deviceWidth]}
            onValueChange={(value) => setAlignment(value as AlignValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(alignmentItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {alignmentInherited && (
            <p className="text-xs text-muted-foreground">
              {t('epkBuilder.hero.inheritsFrom', { device: inheritsFromLabel, value: alignmentItems[alignmentValues[deviceWidth]] })}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t('epkBuilder.hero.height')}</Label>
          <Select
            items={heightItems}
            value={heightValues[deviceWidth]}
            onValueChange={(value) => setHeight(value as HeightValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(heightItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {heightInherited && (
            <p className="text-xs text-muted-foreground">
              {t('epkBuilder.hero.inheritsFrom', { device: inheritsFromLabel, value: heightItems[heightValues[deviceWidth]] })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>{t('epkBuilder.hero.darkOverlay')}</Label>
        <Switch
          checked={config.overlay ?? true}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, overlay: checked }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.ctaLabel')}</Label>
        <Input
          placeholder={t('epkBuilder.hero.ctaLabelPlaceholder')}
          value={config.cta_label ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, cta_label: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('epkBuilder.hero.ctaUrl')}</Label>
        <Input
          placeholder="https://…"
          value={config.cta_url ?? ''}
          onChange={(event) => setConfig((prev) => ({ ...prev, cta_url: event.target.value }))}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the new i18n keys**

Add two new keys inside the existing `"hero": {` block, and two new keys inside the
existing `"device": {` block, in all 7 locale files.

`en.json` — inside `"hero": {`, add after `"heightLarge": "Large",`:
```json
      "inheritsFrom": "Inherits from {{device}}: {{value}}",
```
inside `"device": {`, add two new keys (alongside the existing `desktop`/`tablet`/`mobile`, which stay as-is):
```json
      "desktopShort": "Desktop",
      "tabletShort": "Tablet",
```

`fr.json` — hero: `"inheritsFrom": "Hérite du {{device}} : {{value}}",` — device: `"desktopShort": "Bureau",` / `"tabletShort": "Tablette",`

`es.json` — hero: `"inheritsFrom": "Hereda de {{device}}: {{value}}",` — device: `"desktopShort": "Escritorio",` / `"tabletShort": "Tablet",`

`pt.json` — hero: `"inheritsFrom": "Herda de {{device}}: {{value}}",` — device: `"desktopShort": "Desktop",` / `"tabletShort": "Tablet",`

`de.json` — hero: `"inheritsFrom": "Übernimmt von {{device}}: {{value}}",` — device: `"desktopShort": "Desktop",` / `"tabletShort": "Tablet",`

`ar.json` — hero: `"inheritsFrom": "موروث من {{device}}: {{value}}",` — device: `"desktopShort": "سطح المكتب",` / `"tabletShort": "الجهاز اللوحي",`

`zh.json` — hero: `"inheritsFrom": "继承自 {{device}}：{{value}}",` — device: `"desktopShort": "桌面",` / `"tabletShort": "平板",`

(`mobileShort` is never needed — mobile is never itself an inheritance *source* in
this feature, only a target.)

- [ ] **Step 5: Verify JSON validity, typecheck, and lint**

Run:
```bash
cd frontend
for f in ar de en es fr pt zh; do node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/$f.json','utf8')); console.log('$f OK')"; done
npx tsc -b --noEmit
npx oxlint src/features/epks/builder/EpkBuilderPage.tsx src/features/epks/builder/SectionSettingsPanel.tsx src/features/epks/builder/settings/HeroSettings.tsx
```
Expected: all 7 locales print OK, `tsc` reports no errors in these three files (it
may still report errors in `LivePreview.tsx`/`sectionRenderers.tsx` — those are
fixed in Tasks 4 and 5), lint clean.

- [ ] **Step 6: Verify live in the browser**

Start both dev servers (`preview_start` with `backend-api` and `frontend-dev`), log
in as `demo@korax.test` / `password`, open any EPK's builder, select (or add) a Hero
section:
- With the device switcher on Desktop, set Height to Large and Alignment to Center.
- Switch to Tablet: confirm the Height/Alignment fields show "Inherits from Desktop:
  Large" / "...: Center" under each. Change Height to Medium — the indicator
  disappears for Height (not Alignment, which is still inherited).
- Switch to Mobile: confirm Height shows no inherits-indicator (nothing set),
  wait — Mobile has never been touched, so it should show "Inherits from Tablet:
  Medium" for Height (since tablet now has an explicit value) and "Inherits from
  Tablet: Center" for Alignment (tablet itself still inheriting from desktop,
  but named as Tablet since that's the immediate parent).
- Switch back to Desktop: confirm Height/Alignment still show Large/Center, with no
  inherits-indicator (desktop never shows one).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/epks/builder/EpkBuilderPage.tsx frontend/src/features/epks/builder/SectionSettingsPanel.tsx frontend/src/features/epks/builder/settings/HeroSettings.tsx frontend/src/i18n/locales/*.json
git commit -m "Make Hero Height/Alignment editable per device in the builder"
```

---

### Task 4: LivePreview per-device rendering

**Files:**
- Modify: `frontend/src/features/epks/builder/LivePreview.tsx`

**Interfaces:**
- Consumes: `DeviceWidth`, `normalizeResponsive` from `@/lib/responsiveValue`
  (Task 1); `deviceWidth` state from `EpkBuilderPage` (already exists, not new).

- [ ] **Step 1: Thread `deviceWidth` into `LivePreview` and `HeroPreview`**

In `frontend/src/features/epks/builder/EpkBuilderPage.tsx`, find the `<LivePreview`
call (already receiving `epk`, `workspaceId`, `sections`, `selectedSectionId`,
`onSelectSection`) and add `deviceWidth={deviceWidth}`:

```tsx
            <LivePreview
              epk={epk}
              workspaceId={epk.workspace_id}
              sections={sections}
              selectedSectionId={effectiveSelectedId}
              onSelectSection={setSelectedSectionId}
              deviceWidth={deviceWidth}
            />
```

In `frontend/src/features/epks/builder/LivePreview.tsx`:

Add the import:
```typescript
import { normalizeResponsive, type DeviceWidth } from '@/lib/responsiveValue'
```

Add `deviceWidth: DeviceWidth` to `LivePreview`'s props type (the `export function
LivePreview({ epk, workspaceId, sections, selectedSectionId, onSelectSection, }: {
... }) {` block), then find the `case 'hero':` branch inside its render switch and
pass it through:

```tsx
              case 'hero':
                return (
                  <HeroPreview
                    config={section.config as HeroConfig}
                    epk={epk}
                    workspaceId={workspaceId}
                    buttonStyle={theme.buttonStyle}
                    deviceWidth={deviceWidth}
                  />
                )
```

- [ ] **Step 2: Update `HeroPreview` to render the selected device's value**

`HeroPreview`'s current full signature and body (confirmed exact as of this plan):

```typescript
function HeroPreview({
  config,
  epk,
  workspaceId,
  buttonStyle,
}: {
  config: HeroConfig
  epk: Epk
  workspaceId: number
  buttonStyle: ReturnType<typeof resolveTheme>['buttonStyle']
}) {
  const { data: media } = useMediaList(workspaceId)
  const background = findMediaUrl(media, config.background_media_id)
  const profile = findMediaUrl(media, config.profile_media_id)

  return (
    <div
      className={cn(
        'relative flex flex-col justify-center gap-3 overflow-hidden px-8 py-12',
        HEIGHT_CLASS[config.height ?? 'large'],
        ALIGN_CLASS[config.alignment ?? 'center']
      )}
      style={
        background
          ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'var(--epk-accent)', color: 'var(--epk-accent-fg)' }
      }
    >
      {background && (config.overlay ?? true) && <div className="absolute inset-0 bg-black/50" />}
      <div
        className={cn('relative z-10 flex flex-col gap-3', ALIGN_CLASS[config.alignment ?? 'center'])}
        style={background ? { color: '#ffffff' } : undefined}
      >
```

Replace it with:

```typescript
function HeroPreview({
  config,
  epk,
  workspaceId,
  buttonStyle,
  deviceWidth,
}: {
  config: HeroConfig
  epk: Epk
  workspaceId: number
  buttonStyle: ReturnType<typeof resolveTheme>['buttonStyle']
  deviceWidth: DeviceWidth
}) {
  const { data: media } = useMediaList(workspaceId)
  const background = findMediaUrl(media, config.background_media_id)
  const profile = findMediaUrl(media, config.profile_media_id)
  const height = normalizeResponsive(config.height, 'large')[deviceWidth]
  const alignment = normalizeResponsive(config.alignment, 'center')[deviceWidth]

  return (
    <div
      className={cn(
        'relative flex flex-col justify-center gap-3 overflow-hidden px-8 py-12',
        HEIGHT_CLASS[height],
        ALIGN_CLASS[alignment]
      )}
      style={
        background
          ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'var(--epk-accent)', color: 'var(--epk-accent-fg)' }
      }
    >
      {background && (config.overlay ?? true) && <div className="absolute inset-0 bg-black/50" />}
      <div
        className={cn('relative z-10 flex flex-col gap-3', ALIGN_CLASS[alignment])}
        style={background ? { color: '#ffffff' } : undefined}
      >
```

(everything after this point in the function — profile image, headline, subtitle,
etc. — is unchanged). `HEIGHT_CLASS`/`ALIGN_CLASS` themselves — the existing small
lookup tables mapping `'small'|'medium'|'large'` and `'left'|'center'|'right'` to
Tailwind classes, unrelated to the three-breakpoint tables added in Task 5 for the
*public* page — stay exactly as they are; only the *key* used to look into them
changes, from a direct `config.height ?? 'large'` read to the per-device-resolved
`height` computed above (same for alignment).

- [ ] **Step 3: Verify typecheck and lint**

Run: `cd frontend && npx tsc -b --noEmit && npx oxlint src/features/epks/builder/EpkBuilderPage.tsx src/features/epks/builder/LivePreview.tsx`
Expected: no errors (this should also clear any remaining `HeroConfig`-shape errors
left over from Task 1 — if `sectionRenderers.tsx` still errors at this point, that's
expected, fixed in Task 5).

- [ ] **Step 4: Verify live in the browser**

With the same Hero section from Task 3's browser check (Desktop=Large/Center,
Tablet=Medium/(inherits Center), Mobile=(inherits Medium)/(inherits Center)):
- With the device switcher set to Desktop, confirm the preview frame shows the
  Large-height hero.
- Switch to Tablet: confirm the preview frame's hero visibly shrinks to the
  Medium height, while still centered.
- Switch to Mobile: confirm it's still at Medium height (inherited from Tablet).
- Switch back to Desktop: confirm it's back to Large.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/epks/builder/EpkBuilderPage.tsx frontend/src/features/epks/builder/LivePreview.tsx
git commit -m "Render the builder's live preview using the selected device's Hero values"
```

---

### Task 5: Public page — real responsive CSS for Hero Height/Alignment

**Files:**
- Modify: `frontend/src/features/public-epk/sectionRenderers.tsx`

**Interfaces:**
- Consumes: `PublicHeroConfig.height`/`.alignment` as
  `{ desktop; tablet; mobile }` objects (Task 2's resolver output) — this is the
  only task that depends on Task 2 being deployed together with it (a mismatch
  between an old resolver and this new renderer would break Hero entirely, so these
  two tasks must ship together, not independently toggleable).

- [ ] **Step 1: Replace the single lookup tables with three breakpoint-specific ones**

In `frontend/src/features/public-epk/sectionRenderers.tsx`, find:

```typescript
const HEIGHT_CLASS: Record<string, string> = {
  small: 'min-h-[20rem]',
  medium: 'min-h-[28rem]',
  large: 'min-h-[38rem]',
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'items-start text-start',
  center: 'items-center text-center',
  right: 'items-end text-end',
}
```

Replace with:

```typescript
// Tailwind's JIT scanner only picks up classes that appear as complete
// literal strings in source -- `sm:${cls}` built at runtime would never be
// seen at build time, so each breakpoint needs its own explicit table
// rather than one table plus a dynamically-added prefix.
const HEIGHT_CLASS_MOBILE: Record<HeightValue, string> = {
  small: 'min-h-[20rem]',
  medium: 'min-h-[28rem]',
  large: 'min-h-[38rem]',
}
const HEIGHT_CLASS_TABLET: Record<HeightValue, string> = {
  small: 'sm:min-h-[20rem]',
  medium: 'sm:min-h-[28rem]',
  large: 'sm:min-h-[38rem]',
}
const HEIGHT_CLASS_DESKTOP: Record<HeightValue, string> = {
  small: 'lg:min-h-[20rem]',
  medium: 'lg:min-h-[28rem]',
  large: 'lg:min-h-[38rem]',
}

const ALIGN_CLASS_MOBILE: Record<AlignValue, string> = {
  left: 'items-start text-start',
  center: 'items-center text-center',
  right: 'items-end text-end',
}
const ALIGN_CLASS_TABLET: Record<AlignValue, string> = {
  left: 'sm:items-start sm:text-start',
  center: 'sm:items-center sm:text-center',
  right: 'sm:items-end sm:text-end',
}
const ALIGN_CLASS_DESKTOP: Record<AlignValue, string> = {
  left: 'lg:items-start lg:text-start',
  center: 'lg:items-center lg:text-center',
  right: 'lg:items-end lg:text-end',
}
```

Add `AlignValue` and `HeightValue` to the `import type { ... } from '@/types'` block
already at the top of this file.

- [ ] **Step 2: Update `HeroSection`'s two usage sites**

Find (inside `function HeroSection`):

```tsx
        HEIGHT_CLASS[config.height] ?? HEIGHT_CLASS.large,
        ALIGN_CLASS[config.alignment] ?? ALIGN_CLASS.center
```

Replace with:

```tsx
        HEIGHT_CLASS_MOBILE[config.height.mobile],
        HEIGHT_CLASS_TABLET[config.height.tablet],
        HEIGHT_CLASS_DESKTOP[config.height.desktop],
        ALIGN_CLASS_MOBILE[config.alignment.mobile],
        ALIGN_CLASS_TABLET[config.alignment.tablet],
        ALIGN_CLASS_DESKTOP[config.alignment.desktop],
```

Find the inner content wrapper:

```tsx
        className={cn('relative z-10 mx-auto flex max-w-3xl flex-col gap-4', ALIGN_CLASS[config.alignment] ?? ALIGN_CLASS.center)}
```

Replace with:

```tsx
        className={cn(
          'relative z-10 mx-auto flex max-w-3xl flex-col gap-4',
          ALIGN_CLASS_MOBILE[config.alignment.mobile],
          ALIGN_CLASS_TABLET[config.alignment.tablet],
          ALIGN_CLASS_DESKTOP[config.alignment.desktop]
        )}
```

- [ ] **Step 3: Verify typecheck, lint, and the full frontend test suite**

Run:
```bash
cd frontend
npx tsc -b --noEmit
npx oxlint src/features/public-epk/sectionRenderers.tsx
npx vitest run
```
Expected: no `tsc` errors anywhere now (this was the last file with a
`HeroConfig`/`PublicHeroConfig`-shape mismatch), lint clean, all existing tests
still pass (70+ tests from before this feature, plus the 11 new ones from Task 1).

- [ ] **Step 4: Verify live in the browser, at real breakpoints**

Using the backend's tinker console (see this session's established pattern: seed a
temporary published EPK with a Hero section, e.g.
`config: ['headline' => 'Responsive Test', 'height' => ['desktop' => 'large', 'tablet' => 'medium', 'mobile' => 'small'], 'alignment' => ['desktop' => 'center', 'tablet' => 'left', 'mobile' => 'right']]`),
open its public page (`/epk/<slug>`) and use the browser tool's `resize_window`:
- At width ≥ 1024px: confirm the Hero is at Large height, center-aligned.
- At width 640–1023px: confirm it's at Medium height, left-aligned.
- At width < 640px: confirm it's at Small height, right-aligned.

Clean up the temporary EPK afterward (delete the section/EPK/any media created),
matching this session's established practice for ad hoc verification data.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/public-epk/sectionRenderers.tsx
git commit -m "Render Hero Height/Alignment responsively on the public page"
```

---

### Task 6: Whole-feature verification and mirror to split repos

**Files:** none (verification and distribution only)

- [ ] **Step 1: Run the complete backend and frontend suites one more time**

```bash
cd backend && php artisan test && vendor/bin/pint --test
cd frontend && npx tsc -b --noEmit && npx vitest run
```
Expected: everything green — this catches any interaction between tasks that
per-task verification might have missed.

- [ ] **Step 2: Re-run the two live-browser checks from Tasks 3–5 back to back**

In the builder: create/select a Hero section, set different Height/Alignment per
device, confirm the preview updates correctly at each device and the
inherits-from indicator behaves correctly. On the public page: confirm real window
resizing changes the rendered Hero at the right pixel widths. This confirms the
full desktop→tablet→mobile chain works end to end, not just each task in isolation.

- [ ] **Step 3: Mirror the changed files to `epk-back` and `epk-front`**

Per this project's established two-repo-split workflow (production pulls from
`epk-back`/`epk-front`, not this monorepo): copy each changed file to its
counterpart path in `C:\Users\Iheb\Desktop\claude code\epk-back` (backend files,
paths without the `backend/` prefix) and `C:\Users\Iheb\Desktop\claude code\epk-front`
(frontend files, paths without the `frontend/` prefix), then commit there with the
same messages as the monorepo commits above. Do not push to GitHub — this project's
established practice this session is to keep commits local until the user
explicitly asks for a push.

- [ ] **Step 4: Report completion**

Summarize to the user: what changed, that both repos are updated, and that nothing
was pushed to GitHub yet.
