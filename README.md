# ShelfSense

Shelf-stock / inventory tracking. Monorepo (npm workspaces).

```
packages/
  design-system/   shelf-sense-ds — the component library (synced to claude.ai/design)
apps/
  web/             shelf-sense-web — Vite + React SPA, consumes shelf-sense-ds
  api/             shelf-sense-api — Express + TypeScript API
specs/             feature specs — the source of truth; see specs/README.md for the process
.design-sync/      design-sync config/notes (stays at repo root even in this monorepo layout)
```

## Setup

```bash
npm install          # installs all workspaces from the root
```

## Commands

```bash
npm run storybook     # browse the design system's components
npm run build:ds       # build the design system package
npm run dev:web        # run the web app (localhost:5173)
npm run dev:api         # run the API (localhost:3001)
npm run typecheck       # typecheck every workspace
```

## Workflow

New feature → write a spec in `specs/` → prototype the UI in Claude Design against the real `shelf-sense-ds` components → implement for real in `apps/web` / `apps/api`. See `specs/README.md`.

If a feature needs a component `shelf-sense-ds` doesn't have yet, add it in `packages/design-system` first and run `/design-sync` before prototyping — Claude Design should only ever build with real, synced components.
