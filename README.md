# ShelfSense

Shelf-stock / inventory tracking. Monorepo (npm workspaces).

```
packages/
  design-system/   shelf-sense-ds — the component library (synced to claude.ai/design, web only)
apps/
  web/             shelf-sense-web — Vite + React SPA, consumes shelf-sense-ds
  api/             shelf-sense-api — Express + TypeScript API
  mobile/          shelf-sense-mobile — Expo (React Native + TypeScript), Android-first, camera + offline SQLite
specs/             feature specs — the source of truth; see specs/README.md for the process
.design-sync/      design-sync config/notes (stays at repo root even in this monorepo layout)
```

**`shelf-sense-ds` is web-only.** It's HTML + compiled CSS — it doesn't run in `apps/mobile`. Design tokens (colors, spacing) may eventually get extracted into a shared package both `web` and `mobile` import, but component implementations are and will stay separate per platform. `/design-sync` and Claude Design likewise only ever apply to `apps/web`.

## Setup

Requires **Node 24+** (see `.nvmrc` / `package.json`'s `engines`) — `nvm use` picks it up automatically if you have nvm. Both deployable Dockerfiles (`apps/web/Dockerfile`, `apps/api/Dockerfile`) build on `node:24-alpine`, so local and containerized builds stay on the same major version.

```bash
npm install          # installs all workspaces from the root
```

## Commands

```bash
npm run storybook     # browse the design system's components
npm run build:ds       # build the design system package
npm run dev:web        # run the web app (localhost:5173)
npm run dev:api         # run the API (localhost:3001)
npm run dev:mobile       # start the Expo dev server (scan the QR with Expo Go, or press a/i)
npm run typecheck       # typecheck every workspace
```

`apps/mobile` needs Expo Go (or a dev build) on a physical Android/iOS device, or a local Android/iOS emulator — none of that is available in this environment, so mobile changes should be run/verified on your own machine.

## Workflow

New feature → write a spec in `specs/` → for **web** features, prototype the UI in Claude Design against the real `shelf-sense-ds` components; for **mobile** features, there's no visual-prototyping stage (Claude Design is web-only) — implement directly against the spec → implement for real in `apps/web` / `apps/api` / `apps/mobile`. See `specs/README.md`.

If a web feature needs a component `shelf-sense-ds` doesn't have yet, add it in `packages/design-system` first and run `/design-sync` before prototyping — Claude Design should only ever build with real, synced components.
