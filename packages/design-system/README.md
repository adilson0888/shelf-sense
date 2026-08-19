# ShelfSense Design System

A React + TypeScript component library for shelf-stock / inventory tracking UIs — dashboards, shelf/SKU listings, replenishment workflows, and sensor-driven alerts.

## Install & use

```bash
npm install
npm run build
```

```tsx
import { Button, StatusBadge, StatCard, DataTable } from "shelf-sense-ds";
import "shelf-sense-ds/styles.css";
```

## Develop

```bash
npm run storybook   # interactive component playground on :6006
npm run dev          # Vite dev server
npm run typecheck
npm run build         # library build -> dist/
npm run build-storybook
```

## Tokens

All color, spacing, radius, typography and shadow values are CSS custom properties defined in `src/styles/tokens.css`, consumed through Tailwind (`tailwind.config.ts`). Never hardcode a hex color or raw px spacing in a component — extend the token set instead. A `.dark` class on any ancestor switches the whole tree to the dark palette.

The core semantic vocabulary is **stock status** — `in-stock` / `low` / `out` / `incoming` — surfaced via `--ss-stock-*` tokens and the `StatusBadge` component. Prefer it over generic `Badge` colors whenever the value being shown is a shelf/SKU stock state.

## Charts

**Library: [`recharts`](https://recharts.org/)** — the standard for any new chart in the app. No charting library ships in this package itself; consuming apps (currently only `apps/web`) add `recharts` as their own dependency and build chart components locally, since a chart is feature-specific until a second consumer needs the same shape. This DS package's job is the *visual standard* a chart must follow, not the chart component itself — recharts' `stroke`/`fill` props take a raw CSS value, so every chart reads its colors from `var(--ss-chart-N)` etc. directly, no separate JS color constants to keep in sync.

- **Series color** — `--ss-chart-1` through `--ss-chart-6` (`src/styles/tokens.css`), a categorical palette namespaced apart from `--ss-stock-*`/`--ss-freshness-*`. Those two are controlled status vocabularies — reusing one for an arbitrary chart series would misleadingly imply that status. Cycle back to `--ss-chart-1` past 6 series.
- **Axis labels & legend text** — `--ss-ink-muted`, `--ss-font-sans` (matches every other secondary/caption text in the DS).
- **Gridlines & reference lines** (e.g. an average line) — `--ss-border-strong`, dashed.
- **Surface & spacing** — a chart lives inside a `Card`/`Modal` like any other content; use the existing `--ss-space-*` scale for its padding, not custom values.
- **Legend-as-toggle interaction** (click an entry to hide/show its series) — the hidden state is the entry's own label at `--ss-ink-muted` with reduced opacity, not a removed/replaced token; this keeps the color→series mapping stable even while toggled off.
- First real usage: `PriceHistoryModal` (`apps/web/src/components/`, see `specs/Price History.md`) — a multi-line chart, one line per product barcode.

## Components

| Component | Purpose |
|---|---|
| `Button` | Primary interactive control (`primary`/`secondary`/`outline`/`ghost`/`danger`, `sm`/`md`/`lg`) |
| `StatusBadge` | Fixed stock-status vocabulary: in-stock, low, out, incoming |
| `Badge` | Generic tag/label (`neutral`/`success`/`warning`/`danger`/`info`) |
| `Card`, `CardHeader`, `CardTitle`, `CardBody`, `CardFooter` | Composable surface container |
| `Input` | Text field with label/hint/error |
| `Select` | Bounded-choice dropdown |
| `Alert` | Page/section-level banner (`success`/`warning`/`danger`/`info`) |
| `StatCard` | Dashboard metric tile with optional trend delta |
| `DataTable` | Typed, generic table for shelf/SKU/shipment listings |

Every component has a Storybook story under `src/components/<Name>/<Name>.stories.tsx` demonstrating its variants — start there before writing new usage.

## Project layout

```
src/
  styles/       tokens.css, globals.css
  lib/          cn() className helper (clsx + tailwind-merge)
  components/   one folder per component: <Name>.tsx, index.ts, <Name>.stories.tsx
  index.ts      public exports
.storybook/     Storybook config
```
