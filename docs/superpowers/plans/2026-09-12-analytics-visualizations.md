# Analytics Page Richer Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Analytics page's five plain progress-bar breakdown cards (Top Referrers, Top Countries, Devices, Top Downloads, Top Private Links) with real Chart.js visualizations: a world choropleth map, a doughnut chart, and a shared horizontal bar chart.

**Architecture:** Purely frontend. Three new presentational components (`CountryChoroplethCard`, `DeviceDonutChart`, `RankingBarChart`) plus one shared card-shell component (`ChartCardShell`) replace the generic `BreakdownCard` on `AnalyticsPage.tsx` only. No backend, API, or database changes.

**Tech Stack:** React 18 + TypeScript + Vite, Chart.js 4 + react-chartjs-2 (already installed), `chartjs-chart-geo` (new) for the choropleth, `world-atlas` (new) for map geometry, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-12-analytics-visualizations-design.md](../specs/2026-09-12-analytics-visualizations-design.md)

## Global Constraints

- Frontend-only. No file under `backend/` is touched by this plan.
- New npm dependencies: `chartjs-chart-geo@4.3.6` (peer dependency `chart.js: ^4.1.0`, satisfied by this repo's installed `chart.js@^4.5.1`) and `world-atlas@2.0.2`. **Do not add `topojson-client` as a separate direct dependency** — `chartjs-chart-geo`'s own package re-exports it as `topojson` (confirmed by reading its published `build/index.d.ts`: `export { topojsonClient as topojson };`), so `import { topojson } from 'chartjs-chart-geo'` is the only import needed. This is a deviation from the design spec's illustrative dependency list, found while pinning exact versions for this plan — the spec's *behavior* (converting the bundled TopoJSON to GeoJSON features) is unchanged, only which package's export supplies the function.
- `world-atlas`'s `countries-110m.json` (`objects.countries.geometries[].id`) uses ISO-3166-1 **numeric** country codes as strings, **always zero-padded to exactly 3 digits** (confirmed by inspecting the published package directly: `"032"` for Argentina, `"250"` for France, `"020"` for Andorra). The `countryCodes.ts` lookup table's `numericId` field must use this exact zero-padded format, or every `Map` lookup against the atlas silently fails.
- The 110m-resolution atlas contains only 177 countries/territories — it omits several small states (e.g. Andorra, Monaco, San Marino, Vatican City). A `country` code with no matching atlas feature is expected, not a bug: the map simply shows no shading for it. `countryCodes.ts` still carries entries for these (250 total, the full ISO-3166 alpha-2 list), since the lookup table's job is alpha-2 → numeric-id/name translation, not membership testing against one specific atlas resolution.
- `BreakdownCard.tsx` (`frontend/src/features/analytics/components/BreakdownCard.tsx`) is **not deleted and not modified**. `AdminDashboardPage.tsx` still imports and uses it for its own, unrelated billing-counter cards (`active_by_plan`, `by_status`). Only `AnalyticsPage.tsx`'s own import of `BreakdownCard` is removed, once nothing in that file references it anymore (Task 6).
- All card titles and empty-state strings reuse existing i18n keys already present in all 7 locales (`analytics.breakdowns.topReferrers`, `.noReferrerData`, `.topCountries`, `.noCountryData`, `.devices`, `.noDeviceData`, `.topDownloads`, `.noDownloadData`, `.topPrivateLinks`, `.noPrivateLinkData`). No new i18n keys, no locale file edits, anywhere in this plan.
- Tests run against the existing canvas stub in `frontend/src/test/setup.ts` (`HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}))`). Every chart-rendering test in this plan asserts on DOM output (a `<canvas>` element exists, or specific text is present) — never on canvas pixel/drawing calls, which the stub cannot produce.
- Every new/modified `.tsx` file matches this codebase's existing import style: `verbatimModuleSyntax` is on in `tsconfig.app.json`, so a type import mixed into a value import from the same module must be marked individually, e.g. `import { Chart as ChartJS, type ChartOptions } from 'chart.js'` (see `PageViewsChart.tsx` for the existing precedent).
- Frontend commands run from the `frontend/` directory: `npx vitest run <path>` for a single test file, `npx vitest run` for the whole suite, `npx tsc -b --noEmit` for typechecking.

---

### Task 1: Country code lookup utility

**Files:**
- Create: `frontend/src/lib/countryCodes.ts`
- Test: `frontend/src/lib/countryCodes.test.ts`

**Interfaces:**
- Produces: `export interface CountryInfo { numericId: string; name: string }`, `export const COUNTRY_CODES: Record<string, CountryInfo>`, `export function lookupCountry(alpha2: string): CountryInfo | null`. Task 5 (`CountryChoroplethCard`) is the only consumer.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/countryCodes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES, lookupCountry } from '@/lib/countryCodes'

describe('lookupCountry', () => {
  it('resolves a known alpha-2 code to its numeric id and name', () => {
    expect(lookupCountry('US')).toEqual({ numericId: '840', name: 'United States' })
  })

  it('resolves a second known code', () => {
    expect(lookupCountry('FR')).toEqual({ numericId: '250', name: 'France' })
  })

  it('is case-insensitive', () => {
    expect(lookupCountry('us')).toEqual({ numericId: '840', name: 'United States' })
  })

  it('returns null for an unknown or malformed code', () => {
    expect(lookupCountry('ZZ')).toBeNull()
    expect(lookupCountry('')).toBeNull()
  })

  it('gives every entry a 3-digit zero-padded numeric id', () => {
    for (const info of Object.values(COUNTRY_CODES)) {
      expect(info.numericId).toMatch(/^\d{3}$/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run src/lib/countryCodes.test.ts`
Expected: FAIL — `Cannot find module '@/lib/countryCodes'` (or similar; the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/countryCodes.ts`:

```typescript
export interface CountryInfo {
  /** ISO-3166-1 numeric code, zero-padded to 3 digits — matches world-atlas topojson feature `id` (e.g. "840" for the US). */
  numericId: string
  /** Human-readable English name for tooltips, e.g. "United States". */
  name: string
}

export const COUNTRY_CODES: Record<string, CountryInfo> = {
  AD: { numericId: '020', name: 'Andorra' },
  AE: { numericId: '784', name: 'UAE' },
  AF: { numericId: '004', name: 'Afghanistan' },
  AG: { numericId: '028', name: 'Antigua and Barbuda' },
  AI: { numericId: '660', name: 'Anguilla' },
  AL: { numericId: '008', name: 'Albania' },
  AM: { numericId: '051', name: 'Armenia' },
  AO: { numericId: '024', name: 'Angola' },
  AQ: { numericId: '010', name: 'Antarctica' },
  AR: { numericId: '032', name: 'Argentina' },
  AS: { numericId: '016', name: 'American Samoa' },
  AT: { numericId: '040', name: 'Austria' },
  AU: { numericId: '036', name: 'Australia' },
  AW: { numericId: '533', name: 'Aruba' },
  AX: { numericId: '248', name: 'Aland Islands' },
  AZ: { numericId: '031', name: 'Azerbaijan' },
  BA: { numericId: '070', name: 'Bosnia and Herzegovina' },
  BB: { numericId: '052', name: 'Barbados' },
  BD: { numericId: '050', name: 'Bangladesh' },
  BE: { numericId: '056', name: 'Belgium' },
  BF: { numericId: '854', name: 'Burkina Faso' },
  BG: { numericId: '100', name: 'Bulgaria' },
  BH: { numericId: '048', name: 'Bahrain' },
  BI: { numericId: '108', name: 'Burundi' },
  BJ: { numericId: '204', name: 'Benin' },
  BL: { numericId: '652', name: 'Saint Barthélemy' },
  BM: { numericId: '060', name: 'Bermuda' },
  BN: { numericId: '096', name: 'Brunei' },
  BO: { numericId: '068', name: 'Bolivia' },
  BQ: { numericId: '535', name: 'Bonaire, Sint Eustatius and Saba' },
  BR: { numericId: '076', name: 'Brazil' },
  BS: { numericId: '044', name: 'Bahamas' },
  BT: { numericId: '064', name: 'Bhutan' },
  BV: { numericId: '074', name: 'Bouvet Island' },
  BW: { numericId: '072', name: 'Botswana' },
  BY: { numericId: '112', name: 'Belarus' },
  BZ: { numericId: '084', name: 'Belize' },
  CA: { numericId: '124', name: 'Canada' },
  CC: { numericId: '166', name: 'Cocos (Keeling) Islands' },
  CD: { numericId: '180', name: 'Congo (DRC)' },
  CF: { numericId: '140', name: 'Central African Republic' },
  CG: { numericId: '178', name: 'Congo (Republic)' },
  CH: { numericId: '756', name: 'Switzerland' },
  CI: { numericId: '384', name: 'Côte d\'Ivoire' },
  CK: { numericId: '184', name: 'Cook Islands' },
  CL: { numericId: '152', name: 'Chile' },
  CM: { numericId: '120', name: 'Cameroon' },
  CN: { numericId: '156', name: 'China' },
  CO: { numericId: '170', name: 'Colombia' },
  CR: { numericId: '188', name: 'Costa Rica' },
  CU: { numericId: '192', name: 'Cuba' },
  CV: { numericId: '132', name: 'Cape Verde' },
  CW: { numericId: '531', name: 'Curaçao' },
  CX: { numericId: '162', name: 'Christmas Island' },
  CY: { numericId: '196', name: 'Cyprus' },
  CZ: { numericId: '203', name: 'Czechia' },
  DE: { numericId: '276', name: 'Germany' },
  DJ: { numericId: '262', name: 'Djibouti' },
  DK: { numericId: '208', name: 'Denmark' },
  DM: { numericId: '212', name: 'Dominica' },
  DO: { numericId: '214', name: 'Dominican Republic' },
  DZ: { numericId: '012', name: 'Algeria' },
  EC: { numericId: '218', name: 'Ecuador' },
  EE: { numericId: '233', name: 'Estonia' },
  EG: { numericId: '818', name: 'Egypt' },
  EH: { numericId: '732', name: 'Western Sahara' },
  ER: { numericId: '232', name: 'Eritrea' },
  ES: { numericId: '724', name: 'Spain' },
  ET: { numericId: '231', name: 'Ethiopia' },
  FI: { numericId: '246', name: 'Finland' },
  FJ: { numericId: '242', name: 'Fiji' },
  FK: { numericId: '238', name: 'Falkland Islands (Malvinas)' },
  FM: { numericId: '583', name: 'Micronesia' },
  FO: { numericId: '234', name: 'Faroe Islands' },
  FR: { numericId: '250', name: 'France' },
  GA: { numericId: '266', name: 'Gabon' },
  GB: { numericId: '826', name: 'United Kingdom' },
  GD: { numericId: '308', name: 'Grenada' },
  GE: { numericId: '268', name: 'Georgia' },
  GF: { numericId: '254', name: 'French Guiana' },
  GG: { numericId: '831', name: 'Guernsey' },
  GH: { numericId: '288', name: 'Ghana' },
  GI: { numericId: '292', name: 'Gibraltar' },
  GL: { numericId: '304', name: 'Greenland' },
  GM: { numericId: '270', name: 'The Gambia' },
  GN: { numericId: '324', name: 'Guinea' },
  GP: { numericId: '312', name: 'Guadeloupe' },
  GQ: { numericId: '226', name: 'Equatorial Guinea' },
  GR: { numericId: '300', name: 'Greece' },
  GS: { numericId: '239', name: 'South Georgia and the South Sandwich Islands' },
  GT: { numericId: '320', name: 'Guatemala' },
  GU: { numericId: '316', name: 'Guam' },
  GW: { numericId: '624', name: 'Guinea-Bissau' },
  GY: { numericId: '328', name: 'Guyana' },
  HK: { numericId: '344', name: 'Hong Kong' },
  HM: { numericId: '334', name: 'Heard Island and McDonald Islands' },
  HN: { numericId: '340', name: 'Honduras' },
  HR: { numericId: '191', name: 'Croatia' },
  HT: { numericId: '332', name: 'Haiti' },
  HU: { numericId: '348', name: 'Hungary' },
  ID: { numericId: '360', name: 'Indonesia' },
  IE: { numericId: '372', name: 'Ireland' },
  IL: { numericId: '376', name: 'Israel' },
  IM: { numericId: '833', name: 'Isle of Man' },
  IN: { numericId: '356', name: 'India' },
  IO: { numericId: '086', name: 'British Indian Ocean Territory' },
  IQ: { numericId: '368', name: 'Iraq' },
  IR: { numericId: '364', name: 'Iran' },
  IS: { numericId: '352', name: 'Iceland' },
  IT: { numericId: '380', name: 'Italy' },
  JE: { numericId: '832', name: 'Jersey' },
  JM: { numericId: '388', name: 'Jamaica' },
  JO: { numericId: '400', name: 'Jordan' },
  JP: { numericId: '392', name: 'Japan' },
  KE: { numericId: '404', name: 'Kenya' },
  KG: { numericId: '417', name: 'Kyrgyzstan' },
  KH: { numericId: '116', name: 'Cambodia' },
  KI: { numericId: '296', name: 'Kiribati' },
  KM: { numericId: '174', name: 'Comoros' },
  KN: { numericId: '659', name: 'Saint Kitts and Nevis' },
  KP: { numericId: '408', name: 'North Korea' },
  KR: { numericId: '410', name: 'South Korea' },
  KW: { numericId: '414', name: 'Kuwait' },
  KY: { numericId: '136', name: 'Cayman Islands' },
  KZ: { numericId: '398', name: 'Kazakhstan' },
  LA: { numericId: '418', name: 'Laos' },
  LB: { numericId: '422', name: 'Lebanon' },
  LC: { numericId: '662', name: 'Saint Lucia' },
  LI: { numericId: '438', name: 'Liechtenstein' },
  LK: { numericId: '144', name: 'Sri Lanka' },
  LR: { numericId: '430', name: 'Liberia' },
  LS: { numericId: '426', name: 'Lesotho' },
  LT: { numericId: '440', name: 'Lithuania' },
  LU: { numericId: '442', name: 'Luxembourg' },
  LV: { numericId: '428', name: 'Latvia' },
  LY: { numericId: '434', name: 'Libya' },
  MA: { numericId: '504', name: 'Morocco' },
  MC: { numericId: '492', name: 'Monaco' },
  MD: { numericId: '498', name: 'Moldova' },
  ME: { numericId: '499', name: 'Montenegro' },
  MF: { numericId: '663', name: 'Saint Martin (French part)' },
  MG: { numericId: '450', name: 'Madagascar' },
  MH: { numericId: '584', name: 'Marshall Islands' },
  MK: { numericId: '807', name: 'North Macedonia' },
  ML: { numericId: '466', name: 'Mali' },
  MM: { numericId: '104', name: 'Myanmar' },
  MN: { numericId: '496', name: 'Mongolia' },
  MO: { numericId: '446', name: 'Macao' },
  MP: { numericId: '580', name: 'Northern Mariana Islands' },
  MQ: { numericId: '474', name: 'Martinique' },
  MR: { numericId: '478', name: 'Mauritania' },
  MS: { numericId: '500', name: 'Montserrat' },
  MT: { numericId: '470', name: 'Malta' },
  MU: { numericId: '480', name: 'Mauritius' },
  MV: { numericId: '462', name: 'Maldives' },
  MW: { numericId: '454', name: 'Malawi' },
  MX: { numericId: '484', name: 'Mexico' },
  MY: { numericId: '458', name: 'Malaysia' },
  MZ: { numericId: '508', name: 'Mozambique' },
  NA: { numericId: '516', name: 'Namibia' },
  NC: { numericId: '540', name: 'New Caledonia' },
  NE: { numericId: '562', name: 'Niger' },
  NF: { numericId: '574', name: 'Norfolk Island' },
  NG: { numericId: '566', name: 'Nigeria' },
  NI: { numericId: '558', name: 'Nicaragua' },
  NL: { numericId: '528', name: 'The Netherlands' },
  NO: { numericId: '578', name: 'Norway' },
  NP: { numericId: '524', name: 'Nepal' },
  NR: { numericId: '520', name: 'Nauru' },
  NU: { numericId: '570', name: 'Niue' },
  NZ: { numericId: '554', name: 'New Zealand' },
  OM: { numericId: '512', name: 'Oman' },
  PA: { numericId: '591', name: 'Panama' },
  PE: { numericId: '604', name: 'Peru' },
  PF: { numericId: '258', name: 'French Polynesia' },
  PG: { numericId: '598', name: 'Papua New Guinea' },
  PH: { numericId: '608', name: 'Philippines' },
  PK: { numericId: '586', name: 'Pakistan' },
  PL: { numericId: '616', name: 'Poland' },
  PM: { numericId: '666', name: 'Saint Pierre and Miquelon' },
  PN: { numericId: '612', name: 'Pitcairn Islands' },
  PR: { numericId: '630', name: 'Puerto Rico' },
  PS: { numericId: '275', name: 'Palestine' },
  PT: { numericId: '620', name: 'Portugal' },
  PW: { numericId: '585', name: 'Palau' },
  PY: { numericId: '600', name: 'Paraguay' },
  QA: { numericId: '634', name: 'Qatar' },
  RE: { numericId: '638', name: 'Reunion' },
  RO: { numericId: '642', name: 'Romania' },
  RS: { numericId: '688', name: 'Serbia' },
  RU: { numericId: '643', name: 'Russia' },
  RW: { numericId: '646', name: 'Rwanda' },
  SA: { numericId: '682', name: 'Saudi Arabia' },
  SB: { numericId: '090', name: 'Solomon Islands' },
  SC: { numericId: '690', name: 'Seychelles' },
  SD: { numericId: '729', name: 'Sudan' },
  SE: { numericId: '752', name: 'Sweden' },
  SG: { numericId: '702', name: 'Singapore' },
  SH: { numericId: '654', name: 'Saint Helena' },
  SI: { numericId: '705', name: 'Slovenia' },
  SJ: { numericId: '744', name: 'Svalbard and Jan Mayen' },
  SK: { numericId: '703', name: 'Slovakia' },
  SL: { numericId: '694', name: 'Sierra Leone' },
  SM: { numericId: '674', name: 'San Marino' },
  SN: { numericId: '686', name: 'Senegal' },
  SO: { numericId: '706', name: 'Somalia' },
  SR: { numericId: '740', name: 'Suriname' },
  SS: { numericId: '728', name: 'South Sudan' },
  ST: { numericId: '678', name: 'Sao Tome and Principe' },
  SV: { numericId: '222', name: 'El Salvador' },
  SX: { numericId: '534', name: 'Sint Maarten (Dutch part)' },
  SY: { numericId: '760', name: 'Syria' },
  SZ: { numericId: '748', name: 'Eswatini' },
  TC: { numericId: '796', name: 'Turks and Caicos Islands' },
  TD: { numericId: '148', name: 'Chad' },
  TF: { numericId: '260', name: 'French Southern Territories' },
  TG: { numericId: '768', name: 'Togo' },
  TH: { numericId: '764', name: 'Thailand' },
  TJ: { numericId: '762', name: 'Tajikistan' },
  TK: { numericId: '772', name: 'Tokelau' },
  TL: { numericId: '626', name: 'Timor-Leste' },
  TM: { numericId: '795', name: 'Turkmenistan' },
  TN: { numericId: '788', name: 'Tunisia' },
  TO: { numericId: '776', name: 'Tonga' },
  TR: { numericId: '792', name: 'Turkey' },
  TT: { numericId: '780', name: 'Trinidad and Tobago' },
  TV: { numericId: '798', name: 'Tuvalu' },
  TW: { numericId: '158', name: 'Taiwan' },
  TZ: { numericId: '834', name: 'Tanzania' },
  UA: { numericId: '804', name: 'Ukraine' },
  UG: { numericId: '800', name: 'Uganda' },
  UM: { numericId: '581', name: 'United States Minor Outlying Islands' },
  US: { numericId: '840', name: 'United States' },
  UY: { numericId: '858', name: 'Uruguay' },
  UZ: { numericId: '860', name: 'Uzbekistan' },
  VA: { numericId: '336', name: 'Vatican City' },
  VC: { numericId: '670', name: 'Saint Vincent and the Grenadines' },
  VE: { numericId: '862', name: 'Venezuela' },
  VG: { numericId: '092', name: 'Virgin Islands, British' },
  VI: { numericId: '850', name: 'Virgin Islands, U.S.' },
  VN: { numericId: '704', name: 'Vietnam' },
  VU: { numericId: '548', name: 'Vanuatu' },
  WF: { numericId: '876', name: 'Wallis and Futuna' },
  WS: { numericId: '882', name: 'Samoa' },
  XK: { numericId: '983', name: 'Kosovo' },
  YE: { numericId: '887', name: 'Yemen' },
  YT: { numericId: '175', name: 'Mayotte' },
  ZA: { numericId: '710', name: 'South Africa' },
  ZM: { numericId: '894', name: 'Zambia' },
  ZW: { numericId: '716', name: 'Zimbabwe' },
}

export function lookupCountry(alpha2: string): CountryInfo | null {
  return COUNTRY_CODES[alpha2.toUpperCase()] ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/countryCodes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/countryCodes.ts frontend/src/lib/countryCodes.test.ts
git commit -m "feat: add ISO-3166 alpha-2 country code lookup for the analytics map"
```

---

### Task 2: New chart dependencies, shared card shell, PageViewsChart refactor

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json` (via `npm install`)
- Create: `frontend/src/features/analytics/components/ChartCardShell.tsx`
- Test: `frontend/src/features/analytics/components/ChartCardShell.test.tsx`
- Modify: `frontend/src/features/analytics/components/PageViewsChart.tsx`

**Interfaces:**
- Produces: `export function ChartCardShell({ title, children }: { title: string; children: React.ReactNode })`. Tasks 3, 4, 5 all wrap their chart output in this component.

- [ ] **Step 1: Install the new dependencies**

Run (from `frontend/`):

```bash
npm install chartjs-chart-geo@4.3.6 world-atlas@2.0.2
```

Expected: `package.json` gains both as direct dependencies; `package-lock.json` updates; install completes with no error (`chartjs-chart-geo`'s peer dependency `chart.js: ^4.1.0` is satisfied by this repo's already-installed `chart.js@^4.5.1` — no peer-dependency warning expected).

- [ ] **Step 2: Write the failing test for ChartCardShell**

Create `frontend/src/features/analytics/components/ChartCardShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'

describe('ChartCardShell', () => {
  it('renders the title and its children', () => {
    render(
      <ChartCardShell title="Test Title">
        <p>child content</p>
      </ChartCardShell>
    )

    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/analytics/components/ChartCardShell.test.tsx`
Expected: FAIL — `Cannot find module '@/features/analytics/components/ChartCardShell'`.

- [ ] **Step 4: Write the implementation**

Create `frontend/src/features/analytics/components/ChartCardShell.tsx`:

```tsx
import type { ReactNode } from 'react'

export function ChartCardShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/analytics/components/ChartCardShell.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Refactor PageViewsChart.tsx to use ChartCardShell**

Replace the full contents of `frontend/src/features/analytics/components/PageViewsChart.tsx` with:

```tsx
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { useTranslation } from 'react-i18next'
import { Line } from 'react-chartjs-2'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'
import type { AnalyticsDailyPoint } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { intersect: false, mode: 'index' },
  },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
}

export function PageViewsChart({ points }: { points: AnalyticsDailyPoint[] }) {
  const { t } = useTranslation()

  const data = {
    labels: points.map((point) =>
      new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: t('analytics.pageViews'),
        data: points.map((point) => point.count),
        borderColor: '#cc1417',
        backgroundColor: 'rgba(204, 20, 23, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }

  return (
    <ChartCardShell title={t('analytics.pageViews')}>
      {points.every((point) => point.count === 0) ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {t('analytics.noPageViews')}
        </div>
      ) : (
        <div className="h-48">
          <Line data={data} options={OPTIONS} />
        </div>
      )}
    </ChartCardShell>
  )
}
```

(Only the wrapping markup changed — the `<div className="rounded-xl...">`/`<p>` pair is now `ChartCardShell`. No prop, data, or behavior change.)

- [ ] **Step 7: Run the full frontend test suite to confirm no regression**

Run (from `frontend/`): `npx vitest run`
Expected: PASS — every existing test (including any that renders `PageViewsChart` indirectly, e.g. through a dashboard page) still passes. There is no dedicated `PageViewsChart.test.tsx` today, so this full-suite run is the regression check for this step.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json \
  frontend/src/features/analytics/components/ChartCardShell.tsx \
  frontend/src/features/analytics/components/ChartCardShell.test.tsx \
  frontend/src/features/analytics/components/PageViewsChart.tsx
git commit -m "feat: add chartjs-chart-geo/world-atlas deps and shared ChartCardShell"
```

---

### Task 3: Device donut chart

**Files:**
- Create: `frontend/src/features/analytics/components/DeviceDonutChart.tsx`
- Test: `frontend/src/features/analytics/components/DeviceDonutChart.test.tsx`

**Interfaces:**
- Consumes: `ChartCardShell` from Task 2 (`import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'`).
- Produces: `export function DeviceDonutChart({ rows }: { rows: { device_type: string; count: number }[] })`. Task 6 renders this with `analytics.devices` (type `AnalyticsDeviceBreakdown[]` from `@/types`, which already has the shape `{ device_type: string; count: number }`).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/analytics/components/DeviceDonutChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeviceDonutChart } from '@/features/analytics/components/DeviceDonutChart'

describe('DeviceDonutChart', () => {
  it('renders the title and a canvas when there is data', () => {
    const { container } = render(
      <DeviceDonutChart
        rows={[
          { device_type: 'desktop', count: 10 },
          { device_type: 'mobile', count: 5 },
        ]}
      />
    )

    expect(screen.getByText('Devices')).toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('renders the empty state and no canvas when there are no rows', () => {
    const { container } = render(<DeviceDonutChart rows={[]} />)

    expect(screen.getByText('No device data yet.')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/analytics/components/DeviceDonutChart.test.tsx`
Expected: FAIL — `Cannot find module '@/features/analytics/components/DeviceDonutChart'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/analytics/components/DeviceDonutChart.tsx`:

```tsx
import { ArcElement, Chart as ChartJS, Tooltip, type ChartOptions } from 'chart.js'
import { useTranslation } from 'react-i18next'
import { Doughnut } from 'react-chartjs-2'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'

ChartJS.register(ArcElement, Tooltip)

const COLORS = ['#6D5EF9', '#10b981', '#f59e0b', '#94a3b8']

const OPTIONS: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
}

export function DeviceDonutChart({ rows }: { rows: { device_type: string; count: number }[] }) {
  const { t } = useTranslation()

  return (
    <ChartCardShell title={t('analytics.breakdowns.devices')}>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {t('analytics.breakdowns.noDeviceData')}
        </div>
      ) : (
        <div className="h-48">
          <Doughnut
            data={{
              labels: rows.map((row) => row.device_type),
              datasets: [{ data: rows.map((row) => row.count), backgroundColor: COLORS, borderWidth: 0 }],
            }}
            options={OPTIONS}
          />
        </div>
      )}
    </ChartCardShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/analytics/components/DeviceDonutChart.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/analytics/components/DeviceDonutChart.tsx \
  frontend/src/features/analytics/components/DeviceDonutChart.test.tsx
git commit -m "feat: add DeviceDonutChart for the analytics Devices breakdown"
```

---

### Task 4: Reusable ranking bar chart

**Files:**
- Create: `frontend/src/features/analytics/components/RankingBarChart.tsx`
- Test: `frontend/src/features/analytics/components/RankingBarChart.test.tsx`

**Interfaces:**
- Consumes: `ChartCardShell` from Task 2.
- Produces: `export function RankingBarChart({ title, emptyLabel, rows }: { title: string; emptyLabel: string; rows: { label: string; count: number }[] })`. Task 6 uses this three times (Top Referrers, Top Downloads, Top Private Links), each time mapping its own field (`referrer`/`filename`/`label`) to `label` before passing `rows`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/analytics/components/RankingBarChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RankingBarChart } from '@/features/analytics/components/RankingBarChart'

describe('RankingBarChart', () => {
  it('renders the title and a canvas when there is data', () => {
    const { container } = render(
      <RankingBarChart
        title="Top referrers"
        emptyLabel="No referrer data yet."
        rows={[
          { label: 'google.com', count: 12 },
          { label: 'twitter.com', count: 4 },
        ]}
      />
    )

    expect(screen.getByText('Top referrers')).toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('renders the passed empty label and no canvas when there are no rows', () => {
    const { container } = render(<RankingBarChart title="Top downloads" emptyLabel="No downloads yet." rows={[]} />)

    expect(screen.getByText('No downloads yet.')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/analytics/components/RankingBarChart.test.tsx`
Expected: FAIL — `Cannot find module '@/features/analytics/components/RankingBarChart'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/analytics/components/RankingBarChart.tsx`:

```tsx
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const OPTIONS: ChartOptions<'bar'> = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 } },
    y: { grid: { display: false } },
  },
}

export function RankingBarChart({
  title,
  emptyLabel,
  rows,
}: {
  title: string
  emptyLabel: string
  rows: { label: string; count: number }[]
}) {
  return (
    <ChartCardShell title={title}>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div style={{ height: Math.max(96, rows.length * 32) }}>
          <Bar
            data={{
              labels: rows.map((row) => row.label),
              datasets: [{ data: rows.map((row) => row.count), backgroundColor: '#6D5EF9', borderRadius: 4 }],
            }}
            options={OPTIONS}
          />
        </div>
      )}
    </ChartCardShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/analytics/components/RankingBarChart.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/analytics/components/RankingBarChart.tsx \
  frontend/src/features/analytics/components/RankingBarChart.test.tsx
git commit -m "feat: add reusable RankingBarChart for ranked analytics breakdowns"
```

---

### Task 5: Country choropleth map card

**Files:**
- Modify: `frontend/tsconfig.app.json`
- Create: `frontend/src/features/analytics/components/CountryChoroplethCard.tsx`
- Test: `frontend/src/features/analytics/components/CountryChoroplethCard.test.tsx`

**Interfaces:**
- Consumes: `lookupCountry` from Task 1 (`import { lookupCountry } from '@/lib/countryCodes'`); `ChartCardShell` from Task 2.
- Produces: `export function CountryChoroplethCard({ rows }: { rows: { country: string; count: number }[] })`. Task 6 renders this with `analytics.top_countries` (type `AnalyticsCountry[]` from `@/types`, shape `{ country: string; count: number }` — passed directly, no field mapping needed unlike the ranking cards).

- [ ] **Step 1: Enable JSON imports in the TypeScript config**

`world-atlas`'s map data is a `.json` file imported directly as a module (`import worldAtlas from 'world-atlas/countries-110m.json'`), which requires `resolveJsonModule`. Edit `frontend/tsconfig.app.json`, adding the option next to the existing `"skipLibCheck": true` line:

```json
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/features/analytics/components/CountryChoroplethCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CountryChoroplethCard } from '@/features/analytics/components/CountryChoroplethCard'

describe('CountryChoroplethCard', () => {
  it('renders the title and a canvas when there is data', () => {
    const { container } = render(
      <CountryChoroplethCard
        rows={[
          { country: 'US', count: 20 },
          { country: 'FR', count: 8 },
        ]}
      />
    )

    expect(screen.getByText('Top countries')).toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('renders the empty state and no canvas when there are no rows', () => {
    const { container } = render(<CountryChoroplethCard rows={[]} />)

    expect(screen.getByText(/No country data yet/)).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('does not throw when a row has an unmapped country code', () => {
    expect(() => render(<CountryChoroplethCard rows={[{ country: 'ZZ', count: 3 }]} />)).not.toThrow()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/analytics/components/CountryChoroplethCard.test.tsx`
Expected: FAIL — `Cannot find module '@/features/analytics/components/CountryChoroplethCard'`.

- [ ] **Step 4: Write the implementation**

Create `frontend/src/features/analytics/components/CountryChoroplethCard.tsx`:

```tsx
import { CategoryScale, Chart as ChartJS, Tooltip } from 'chart.js'
import { ChoroplethController, ColorScale, GeoFeature, ProjectionScale, topojson } from 'chartjs-chart-geo'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Chart } from 'react-chartjs-2'
import worldAtlas from 'world-atlas/countries-110m.json'
import { ChartCardShell } from '@/features/analytics/components/ChartCardShell'
import { lookupCountry } from '@/lib/countryCodes'

ChartJS.register(ChoroplethController, GeoFeature, ColorScale, ProjectionScale, CategoryScale, Tooltip)

// world-atlas ships raw TopoJSON; chartjs-chart-geo's GeoFeature datasets need
// GeoJSON features, so this converts once at module load (the atlas itself
// never changes at runtime).
const COUNTRIES = (topojson.feature(worldAtlas as any, (worldAtlas as any).objects.countries) as any).features as {
  id: string
  properties: { name: string }
}[]

export function CountryChoroplethCard({ rows }: { rows: { country: string; count: number }[] }) {
  const { t } = useTranslation()

  const { entries, max } = useMemo(() => {
    const countByNumericId = new Map<string, { count: number; name: string }>()
    for (const row of rows) {
      const info = lookupCountry(row.country)
      if (info) countByNumericId.set(info.numericId, { count: row.count, name: info.name })
    }

    const values = COUNTRIES.map((feature) => {
      const match = countByNumericId.get(feature.id)
      return { feature, value: match?.count ?? 0, name: match?.name ?? feature.properties.name }
    })

    return { entries: values, max: Math.max(1, ...rows.map((row) => row.count)) }
  }, [rows])

  return (
    <ChartCardShell title={t('analytics.breakdowns.topCountries')}>
      {rows.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          {t('analytics.breakdowns.noCountryData')}
        </div>
      ) : (
        <div className="h-56">
          <Chart
            type="choropleth"
            data={{
              labels: entries.map((entry) => entry.name),
              datasets: [{ data: entries.map((entry) => ({ feature: entry.feature, value: entry.value })) }],
            }}
            options={
              {
                responsive: true,
                maintainAspectRatio: false,
                showOutline: true,
                showGraticule: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx: any) => `${ctx.raw.name}: ${Number(ctx.raw.value).toLocaleString()}`,
                    },
                  },
                },
                scales: {
                  projection: { axis: 'x', projection: 'equalEarth' },
                  color: {
                    axis: 'x',
                    quantize: 5,
                    legend: { position: 'bottom-right' },
                    interpolate: (v: number) => `rgba(109, 94, 249, ${0.15 + v * 0.75})`,
                    min: 0,
                    max,
                  },
                },
              } as any
            }
          />
        </div>
      )}
    </ChartCardShell>
  )
}
```

(`as any` is used only at the three points where `chartjs-chart-geo`'s types don't line up cleanly with `react-chartjs-2`'s generic `<Chart>` component and with the raw TopoJSON import — the same accommodation this library's own usage examples make. Every other value stays fully typed.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/analytics/components/CountryChoroplethCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/tsconfig.app.json \
  frontend/src/features/analytics/components/CountryChoroplethCard.tsx \
  frontend/src/features/analytics/components/CountryChoroplethCard.test.tsx
git commit -m "feat: add CountryChoroplethCard for the analytics Top Countries map"
```

---

### Task 6: Wire the new components into AnalyticsPage

**Files:**
- Modify: `frontend/src/features/analytics/pages/AnalyticsPage.tsx`
- Test: `frontend/src/features/analytics/pages/AnalyticsPage.test.tsx` (new — none exists today)

**Interfaces:**
- Consumes: `CountryChoroplethCard` (Task 5), `DeviceDonutChart` (Task 3), `RankingBarChart` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/analytics/pages/AnalyticsPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

const workspace = {
  id: 1,
  name: 'Acme Records',
  slug: 'acme-records',
  description: null,
  logo_url: null,
  my_role: 'owner',
  members_count: 1,
  created_at: '2026-01-01T00:00:00.000000Z',
  updated_at: '2026-01-01T00:00:00.000000Z',
}

const epk = {
  id: 7,
  title: 'Summer Tour EPK',
  status: 'published',
  slug: 'summer-tour',
  workspace_id: 1,
  artist_id: 1,
  created_at: '2026-01-01T00:00:00.000000Z',
  updated_at: '2026-01-01T00:00:00.000000Z',
}

function analyticsResponse() {
  return {
    data: {
      from: '2026-08-12',
      to: '2026-09-10',
      totals: { page_views: 42, unique_visitors: 30, downloads: 5, audio_plays: 0, video_plays: 0 },
      daily_page_views: [{ date: '2026-09-10', count: 42 }],
      top_referrers: [{ referrer: 'google.com', count: 12 }],
      top_countries: [{ country: 'US', count: 20 }],
      devices: [{ device_type: 'desktop', count: 10 }],
      top_downloads: [{ filename: 'press-kit.pdf', count: 6 }],
      top_private_links: [{ label: 'VIP link', count: 3 }],
    },
  }
}

function renderPage() {
  server.use(
    http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: [workspace] })),
    http.get(`${API_URL}/api/epks`, () => HttpResponse.json({ data: [epk] })),
    http.get(`${API_URL}/api/epks/7/analytics`, () => HttpResponse.json(analyticsResponse()))
  )

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>
  )
}

describe('AnalyticsPage', () => {
  it('renders the country map, device donut, and ranking bar charts once data loads', async () => {
    const { container } = renderPage()

    await screen.findByText('Top referrers')
    expect(screen.getByText('Top countries')).toBeInTheDocument()
    expect(screen.getByText('Devices')).toBeInTheDocument()
    expect(screen.getByText('Top downloads')).toBeInTheDocument()
    expect(screen.getByText('Top private links')).toBeInTheDocument()

    // 5 charts (PageViewsChart + the 4 new canvas-based cards; the map also renders via <canvas>).
    expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/analytics/pages/AnalyticsPage.test.tsx`
Expected: FAIL — the page still renders `BreakdownCard` progress-bar lists, not the new chart titles/canvases (or a similar assertion failure; the test targets behavior that doesn't exist yet).

- [ ] **Step 3: Update AnalyticsPage.tsx**

In `frontend/src/features/analytics/pages/AnalyticsPage.tsx`:

Replace this import block:

```tsx
import { BreakdownCard } from '@/features/analytics/components/BreakdownCard'
import { PageViewsChart } from '@/features/analytics/components/PageViewsChart'
```

with:

```tsx
import { CountryChoroplethCard } from '@/features/analytics/components/CountryChoroplethCard'
import { DeviceDonutChart } from '@/features/analytics/components/DeviceDonutChart'
import { PageViewsChart } from '@/features/analytics/components/PageViewsChart'
import { RankingBarChart } from '@/features/analytics/components/RankingBarChart'
```

Replace the five `<BreakdownCard ... />` elements (the whole `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">...</div>` block) with:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <RankingBarChart
    title={t('analytics.breakdowns.topReferrers')}
    emptyLabel={t('analytics.breakdowns.noReferrerData')}
    rows={analytics.top_referrers.map((row) => ({ label: row.referrer, count: row.count }))}
  />
  <CountryChoroplethCard rows={analytics.top_countries} />
  <DeviceDonutChart rows={analytics.devices} />
  <RankingBarChart
    title={t('analytics.breakdowns.topDownloads')}
    emptyLabel={t('analytics.breakdowns.noDownloadData')}
    rows={analytics.top_downloads.map((row) => ({ label: row.filename, count: row.count }))}
  />
  <RankingBarChart
    title={t('analytics.breakdowns.topPrivateLinks')}
    emptyLabel={t('analytics.breakdowns.noPrivateLinkData')}
    rows={analytics.top_private_links.map((row) => ({ label: row.label, count: row.count }))}
  />
</div>
```

No other part of `AnalyticsPage.tsx` changes — the range selector, EPK selector, stat tiles, and `PageViewsChart` usage stay exactly as they are.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/analytics/pages/AnalyticsPage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full frontend verification suite**

Run (from `frontend/`):

```bash
npx vitest run
npx tsc -b --noEmit
npx oxlint
```

Expected: all three pass — every test green (including Tasks 1-5's new test files and the full pre-existing suite), no type errors (this confirms the `resolveJsonModule` addition from Task 5 and the new `chartjs-chart-geo` types resolve correctly project-wide), no lint errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/analytics/pages/AnalyticsPage.tsx \
  frontend/src/features/analytics/pages/AnalyticsPage.test.tsx
git commit -m "feat: wire map/donut/bar charts into the Analytics page breakdown cards"
```

---

## Post-plan mirror step (not a task — part of this project's standing workflow)

Per this repo's established pattern, after all 6 tasks are complete and reviewed: run `npm run build` in `frontend/` to refresh the committed `dist/` bundle, commit that rebuild, then copy the changed frontend files (and the refreshed `dist/`) into the sibling `epk-front` split repo and commit there with the same message describing the feature. `epk-back` is untouched (no backend changes in this plan). Do not push any repo until the user explicitly says so.
