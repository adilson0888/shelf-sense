# Specs

This is where features start. A spec is written and agreed *before* UI exploration or implementation begins — it's the thing both Claude Design and the real implementation are checked against, not a formality written after the fact.

## The loop

1. **Write the spec** — copy `TEMPLATE.md` to `specs/<feature-name>.md`, fill it in. Status: `draft`.
2. **Prototype in Claude Design**, scoped to the spec's "UI requirements" section, using the real `shelf-sense-ds` components. Iterate visually until the flow feels right.
3. **Update the spec** with anything the prototyping revealed (a missing state, a component gap, a flow change) — the spec stays the source of truth, not the prototype. Status: `ready`.
   - If prototyping needed a component `shelf-sense-ds` doesn't have yet: build it in `packages/design-system` first, re-run `/design-sync`, then continue. Never let a one-off component live only inside a Claude Design prototype.
4. **Implement for real** in `apps/web` / `apps/api` against the spec — real data, real state, error/loading handling, tests. The Claude Design prototype is a structural reference, not code to merge as-is. Status: `in-progress`.
5. **Mark it `done`** once acceptance criteria are met and tests pass. Leave the spec in place — it's the durable record of what that feature is supposed to do, useful the next time it needs to change.

## Naming

`specs/<kebab-case-feature-name>.md`, e.g. `specs/inventory-dashboard.md`, `specs/shelf-detail.md`, `specs/low-stock-alerts.md`. One spec per user-facing feature or flow — not one per component, not one giant spec for the whole app.

## Deferring an idea

A requirement can be real and still not belong in the current pass — when that happens, don't bury it in a spec's "Out of scope" section (that's for things a spec permanently doesn't cover) and don't just delete it. Move it to `specs/BACKLOG.md` with a pointer left behind in the spec it came from, and promote it back through the normal loop above when it's time to build it.
