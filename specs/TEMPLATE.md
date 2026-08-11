# Feature name

**Status:** draft | ready | in-progress | done

## User story

As a **role**, I want to **action**, so that **benefit**.

## Acceptance criteria

- [ ] Given ..., when ..., then ...
- [ ] Given ..., when ..., then ...

## Data

What entities/fields does this touch? What does the API need to return? (Sketch the shape — this drives both the `apps/api` route and the `apps/web` types.)

```ts
// example
interface Shelf {
  id: string;
  aisle: string;
  status: "in-stock" | "low" | "out" | "incoming";
}
```

## UI requirements

- Which screen(s)/flow — describe states: empty, loading, error, populated.
- Which `shelf-sense-ds` components this should use (name them; if one doesn't exist yet, note it here and build it first).
- This section is what gets handed to Claude Design to prototype.

## Non-functional

- Performance, error handling, accessibility, permissions — anything that won't show up in a quick visual prototype but matters for the real implementation.

## Out of scope

What this spec deliberately does NOT cover (keeps scope honest).
