# Persistence & Migrations

**Status:** in-progress — Postgres + Drizzle wired into `apps/api` (`GET`/`POST /products`, `PATCH /products/:id`, auto-migrate-on-boot); `apps/web`'s Product List, Product Add, and Product Edit now read/write through it instead of `mocks/products.ts`. Quick Batch Edit / Stock Edit still local-state only (unchanged, per their own specs). Decided in conversation (2026-08-12) rather than via a Claude Design prototype — this is backend infra with no UI, so the spec loop's prototyping step doesn't apply.

## User story

As a self-hosted operator, I want my product/batch data to survive restarts and upgrade cleanly when I pull a new image, so that I never lose my pantry data or have to run manual steps just to keep the app working.

As the developer wiring up `Product List.md` and `Product Add.md`'s first real `apps/api` endpoints, I need an actual database and a migration story before either spec's data can outlive a process restart.

## Acceptance criteria

- [ ] Given the API container restarts (crash, redeploy, host reboot), when it comes back up, then all previously saved Products/Batches/Barcodes/aliases are still present — data lives in a Postgres volume, not in-process memory.
- [ ] Given a self-hoster's only upgrade action is `docker compose pull && docker compose up -d` (or an unattended updater), when the new `api` image starts, then any pending schema migrations apply automatically before the server accepts traffic — no manual migrate command required.
- [ ] Given a migration fails on startup, when that happens, then the container exits non-zero with the failure logged clearly (visible via `docker logs`) — it never starts serving traffic against a half-migrated schema.
- [ ] Given the API starts with no pending migrations (already up to date), when it boots, then startup does nothing destructive and isn't meaningfully slowed — running the migrator is idempotent on every boot, not just upgrades.
- [ ] Given two requests try to create a Product with the same `short_description` concurrently, when both attempt to save, then the database's own unique constraint rejects the second — enforced at the data layer, not only in application code (per `Product Add.md`).
- [ ] Given a barcode is linked to product A and a save links it to product B instead, when that save commits, then the unlink-from-A and link-to-B happen in one transaction — never a moment where both or neither hold it (per `Product Add.md` / `Product Edit.md`'s shared invariant).

## Data

**Decisions:**
- **Engine: Postgres.** Runs as its own `docker-compose.yml` service with a named volume.
- **Query layer: Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) — typed schema-as-code, works the same way if the engine ever changes, matches `apps/api`'s current minimal-dependency style.
- **Scope: single-user.** No `user_id` anywhere yet — none of the existing specs mention auth/accounts. Add it later alongside a real auth spec rather than modeling it speculatively now.
- **Migrations: checked-in files, applied automatically on boot** — see Non-functional.

**Schema** (`apps/api/src/db/schema.ts`, sketch — maps directly to the entities `Product List.md` / `Product Add.md` / `Product Edit.md` already defined; not redefining those interfaces here, only how they're stored):

```ts
import { pgTable, uuid, text, integer, boolean, date, uniqueIndex } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  shortDescription: text("short_description").notNull(),
  longDescription: text("long_description").notNull().default(""),
  doesExpire: boolean("does_expire").notNull().default(true),
  freshnessThresholdDays: integer("freshness_threshold_days"), // null = follow global preference
  minimalQuantity: integer("minimal_quantity"),                // null = follow global preference
}, (table) => ({
  shortDescriptionUnique: uniqueIndex("products_short_description_unique").on(table.shortDescription),
}));

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  expiresOn: date("expires_on", { mode: "string" }), // null = does not expire
});

export const productAliases = pgTable("product_aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
}, (table) => ({
  // an alias resolves to exactly one product — same global-uniqueness shape as barcodes
  aliasUnique: uniqueIndex("product_aliases_alias_unique").on(table.alias),
}));

export const barcodes = pgTable("barcodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  description: text("description").notNull().default(""),
}, (table) => ({
  // enforces "a barcode belongs to one product at a time" at the DB layer, not just app logic
  codeUnique: uniqueIndex("barcodes_code_unique").on(table.code),
}));
```

**What this unblocks — initial API surface:**
- `GET /products` — all products with their batches/aliases/barcodes, for `Product List.md`.
- `POST /products` — create a product, optionally with one initial batch (`quantity > 0` per `Product Add.md`'s rules); enforces `short_description` uniqueness (409 on conflict) and the `does_expire`+`quantity`+`expires_on` validation at the data layer, not just the form.
- `PATCH /products/:id` — persist `Product Edit.md`'s Save: field edits, alias/barcode add/remove/move (via an explicit `other_product_updates` unlink list the client's own confirm-move flow already resolved), and the `does_expire`-off batch-`expires_on`-clearing cascade, all as one transaction.

Exact request/response shapes get finalized during implementation against these tables — this is the contract that makes both specs' data durable, not a full route-by-route API spec.

**Trimmed during implementation (2026-08-12)**: a third endpoint, `POST /products/:id/batches` for the "use this" matched-product path, was sketched above originally but dropped — tracing the actual `apps/web` code showed every Add Product entry method funnels through one save that always creates a brand-new product; "use this" only prefills the form with the matched product's values, it doesn't attach a batch to the existing row. There's no real caller for a batches-on-existing-product endpoint yet. Revisit once the scan/match flow itself gets wired for real (still `MOCK_BARCODE_MATCH`-simulated, see `Product Add.md`'s Out of scope).

## Non-functional

- **Migration workflow**: author migrations at dev time with `drizzle-kit generate`, which diffs the Drizzle schema against the last migration and writes a real SQL file into `apps/api/drizzle/` — committed to the repo like any other code change, and hand-editable for data backfills a pure diff can't infer (e.g. defaulting existing rows on a new `NOT NULL` column).
- **Never use `drizzle-kit push`** (auto schema-diff-and-apply) against a real deployment — no ordered history, no room for data backfills, can silently do lossy things (e.g. drop-and-recreate a column) against a self-hoster's real pantry data. Fine for local prototyping only.
- **Apply automatically on boot**: `apps/api/src/index.ts` runs the Drizzle migrator against `DATABASE_URL` before calling `app.listen()`. Drizzle tracks applied migrations in its own table, so this is safe and idempotent on every restart — a self-hoster's `docker compose pull && up -d` is the entire upgrade action, nothing manual.
- **Stated assumption: single-instance deploys.** `docker-compose.yml` runs one `api` container, no replicas — so the harder "expand/contract" zero-downtime migration pattern (old and new code versions running concurrently against the same schema mid-migration) isn't needed; a brief restart-time gap is acceptable. Revisit this migration approach if that ever changes (e.g. multiple API replicas behind a load balancer).
- **Config**: `DATABASE_URL` env var, same variable name for local dev and the Docker image. `docker-compose.yml` needs a new `db` service (Postgres + named volume) that `api` depends on; `docker-compose.registry.yml` needs the equivalent.
- **Local dev**: `docker compose up db` (or the full stack) for a real Postgres instance — no SQLite-vs-Postgres divergence between dev and prod to reason about.
- **Testing**: not decided here — flagging as an open follow-up (likely a throwaway Postgres via `docker compose` in CI, or per-test transaction rollback) rather than deciding it as a side effect of this doc.

## Out of scope

- **Multi-user / auth** (`user_id`, row-level scoping) — no spec defines accounts yet; add this alongside a real auth spec, not speculatively here.
- **Batch cost tracking & consumed-batch history** — already tracked in `specs/BACKLOG.md`; the schema above hard-deletes an emptied batch, matching today's spec'd behavior, not the deferred one.
- **Product icon storage** (`Product.icon`) — deferred, see `specs/BACKLOG.md`.
- **The external integrations themselves** (`identify-from-photo` vision call, barcode-lookup-by-value against Open Food Facts) — `Product Add.md`'s scan/photo steps stay client-simulated (`MOCK_BARCODE_MATCH`) for this pass; this doc only makes the manual-entry/create and list/read paths real. Wiring the external calls is separate follow-up work, not blocked by this doc.
- **Backup/restore automation** — a self-hoster's Postgres volume is theirs to back up; the app doesn't automate this.
- **Zero-downtime migrations for multi-replica deploys** — out of scope per the single-instance assumption above.
