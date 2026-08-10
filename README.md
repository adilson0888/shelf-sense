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
