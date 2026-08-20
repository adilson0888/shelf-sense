# Contributing

ShelfSense is a monorepo (npm workspaces). This doc covers working on the codebase itself. If you just want to run the app, see [README.md](README.md) and [INSTALL.md](INSTALL.md) instead.

```
packages/
  design-system/   shelf-sense-ds — the component library (synced to claude.ai/design, web only)
  i18n/            shelf-sense-i18n — locale dictionaries + translation helpers
apps/
  web/             shelf-sense-web — Vite + React SPA, consumes shelf-sense-ds
  api/             shelf-sense-api — Express + TypeScript API
  mobile/          shelf-sense-mobile — Expo (React Native + TypeScript), Android-first, camera + offline SQLite
specs/             feature specs — the source of truth; see specs/README.md for the process
.design-sync/      design-sync config/notes (stays at repo root even in this monorepo layout)
```

**`shelf-sense-ds` is web-only.** It's HTML + compiled CSS — it doesn't run in `apps/mobile`. Design tokens (colors, spacing) may eventually get extracted into a shared package both `web` and `mobile` import, but component implementations are and will stay separate per platform. `/design-sync` and Claude Design likewise only ever apply to `apps/web`.

## How contributions are evaluated

ShelfSense is built spec-driven — every feature starts as a spec in `specs/` before any code is written (see [specs/README.md](specs/README.md) for the full loop), and that stays true for outside contributions too. What's expected depends on what you're changing:

**New feature or behavior change.** A spec — new, or an update to an existing one — is mandatory, and it's what gets evaluated, not the code. Copy `specs/TEMPLATE.md` and fill in the user story, acceptance criteria, data shape, and UI requirements the way `specs/README.md`'s loop describes. Code alongside it is welcome but optional — you don't need to have written any implementation to open a spec PR. One step of the loop is internal (prototyping in Claude Design against `shelf-sense-ds`); outside contributors aren't expected to do that part, just the spec's prose. **A code-only PR for a new feature or behavior change, with no accompanying spec, gets closed** with a pointer back here — reopen it once a spec exists.

**Bug fix.** No new spec needed, unless the fix reveals that the existing spec itself was wrong or ambiguous — in that case, correcting the spec is part of the fix. Otherwise just describe the bug and the fix.

**Chore** (dependency bump, CI, docs, typos, etc.). No spec involved — open the PR.

## Setup

Requires **Node 24+** (see `.nvmrc` / `package.json`'s `engines`) — `nvm use` picks it up automatically if you have nvm. Both deployable Dockerfiles (`apps/web/Dockerfile`, `apps/api/Dockerfile`) build on `node:24-alpine`, so local and containerized builds stay on the same major version.

```bash
npm install          # installs all workspaces from the root
```

A local Postgres instance is needed for `apps/api` — the fastest way to get one is `docker compose up -d db` (see the root `docker-compose.yml`), then copy `apps/api/.env.example` to `apps/api/.env`.

## Commands

```bash
npm run storybook     # browse the design system's components
npm run build:ds       # build the design system package
npm run dev:web        # run the web app (localhost:5173)
npm run dev:api         # run the API (localhost:3001)
npm run dev:mobile       # start the Expo dev server (scan the QR with Expo Go, or press a/i)
npm run typecheck       # typecheck every workspace
```

`apps/mobile` needs Expo Go (or a dev build) on a physical Android/iOS device, or a local Android/iOS emulator.

## Workflow

New feature → write a spec in `specs/` → for **web** features, prototype the UI in Claude Design against the real `shelf-sense-ds` components; for **mobile** features, there's no visual-prototyping stage (Claude Design is web-only) — implement directly against the spec → implement for real in `apps/web` / `apps/api` / `apps/mobile`. Full loop, status conventions, and the backlog-deferral process are in [specs/README.md](specs/README.md).

If a web feature needs a component `shelf-sense-ds` doesn't have yet, add it in `packages/design-system` first and run `/design-sync` before prototyping — Claude Design should only ever build with real, synced components.

## License

By contributing, you agree your contributions are licensed under the project's [AGPL-3.0 license](LICENSE).
