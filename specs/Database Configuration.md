# Database Configuration

**Status:** in-progress — `apps/api/src/db/client.ts`'s `resolvePgConfig()`, `.env.example`, and both `docker-compose*.yml` files implemented and verified (discrete vars, `DATABASE_URL` precedence, `DB_PORT` default, and the fail-fast missing-vars error all confirmed against a real Postgres instance). No UI involved, so nothing in `apps/web`/`apps/mobile`.

## User story

As a self-hosted operator — especially one who isn't a developer and is following the same pattern they already know from other self-hosted apps — I want to configure the database connection with discrete `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` variables instead of assembling a single connection-string URL by hand, so setup matches what I'm already used to and I can't get it wrong by mis-escaping a special character into a URL.

This amends `specs/Persistence.md`'s Non-functional "Config: `DATABASE_URL` env var" line — everything else that doc specifies (Postgres, Drizzle, migrate-on-boot) is unchanged.

## Acceptance criteria

- [ ] Given `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` are all set (and `DATABASE_URL` is not), when `apps/api` boots, then it connects using those discrete values.
- [ ] Given `DATABASE_URL` is set, when `apps/api` boots, then it's used as-is and takes precedence over any `DB_*` variables also present — an explicit full connection string is a more specific choice than discrete defaults, and this keeps today's existing local-dev setup (`apps/api/.env.example`) and anyone pointed at a managed Postgres provider that hands them one URL working unchanged.
- [ ] Given `DB_PORT` is omitted but `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` are all present, when `apps/api` boots, then it defaults to `5432` — the one discrete variable with a universally-safe default; the other four have no sensible default and must be provided explicitly.
- [ ] Given neither `DATABASE_URL` nor a complete discrete set (`DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`, `DB_PORT` optional) is available, when `apps/api` boots, then it fails fast with a clear startup error naming exactly which variable(s) are missing — same "never start against a half-configured setup" ethos `specs/Persistence.md` already states for a failed migration, applied one step earlier (before a connection is even attempted).
- [ ] Given the operator follows `docker-compose.yml`'s example, when they run it unmodified, then it works — `docker-compose.yml`/`docker-compose.registry.yml` set the discrete `DB_*` vars on the `api` service (sourced from the same `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` compose variables the `db` service already uses) instead of composing a `DATABASE_URL` string.
- [ ] Given a fresh clone with no `.env` yet, when the operator opens `apps/api/.env.example`, then the discrete variables are documented as the primary path (with example values), and `DATABASE_URL` is documented immediately after as an alternate/override for anyone who already has a connection string.

## Data

No entities affected — this is deployment configuration only, not app data.

**`apps/api/src/db/client.ts`** (currently ~10 lines: reads `DATABASE_URL`, throws if unset, constructs `new Pool({ connectionString })`) changes to resolve either shape before constructing the pool:

```ts
function resolvePgConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  const missing = [
    !DB_HOST && "DB_HOST",
    !DB_NAME && "DB_NAME",
    !DB_USER && "DB_USER",
    !DB_PASSWORD && "DB_PASSWORD",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Database not configured — set DATABASE_URL, or all of: ${missing.join(", ")} (see apps/api/.env.example).`,
    );
  }
  return {
    host: DB_HOST,
    port: DB_PORT ? Number(DB_PORT) : 5432,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  };
}

export const pool = new Pool(resolvePgConfig());
```

`node-postgres`'s `Pool` already accepts either `{ connectionString }` or discrete `{ host, port, database, user, password }` natively — no manual URL construction needed either direction.

## UI requirements

None — this is entirely deploy-time configuration, no app UI involved (matches `specs/Persistence.md`'s own "no UI, spec loop's prototyping step doesn't apply" note).

## Non-functional

- **`DB_PASSWORD` is never logged**, including in the startup failure message above — the error names *which variables* are missing, never any value that was provided.
- **Fails at process start, before `app.listen()`** — same boot-order guarantee `specs/Persistence.md` already states for a failed migration; a misconfigured DB connection must never result in the API accepting HTTP traffic it can't actually serve.
- **Local dev unaffected**: `apps/api/.env.example`'s current `DATABASE_URL=postgres://shelf:shelf@localhost:5432/shelfsense` keeps working unchanged (it's the `DATABASE_URL`-set path) — this spec adds a second supported path, it doesn't remove the first.
- **No new dependency** — `pg` (already a dependency, see `apps/api/src/db/client.ts`) supports both config shapes out of the box.

## Out of scope

- **SSL/TLS-specific variables** (`DB_SSL`, cert paths, etc.) — not needed for the documented Docker Compose / local-Postgres deployment target; revisit if a specific hosting target actually requires it.
- **Validating connectivity before Drizzle's own migration step runs** — `resolvePgConfig()` only validates that the *variables* needed to attempt a connection are present; an unreachable host/wrong password still surfaces as whatever error `pg`/Drizzle already produce today, unchanged by this spec.
- **Database setup/creation from the app itself** (creating the database, running `CREATE USER`, etc., or any of this reachable from the Settings UI) — the operator's own responsibility, same as today; this app has no in-UI database administration and this spec doesn't add any.
