import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema.js";

/**
 * specs/Database Configuration.md — two supported ways to point at
 * Postgres. DATABASE_URL wins if set (an explicit full connection string
 * is a more specific choice, and it's what local dev / anyone on a
 * managed-Postgres-with-one-URL provider already uses, see
 * apps/api/.env.example); otherwise falls back to discrete DB_* vars,
 * which most self-hosted-app operators expect over assembling a URL by
 * hand. DB_PORT is the only one of the five with a sensible default.
 */
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
  ].filter((name): name is string => Boolean(name));
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

// pg.Pool emits "error" for idle clients that get disconnected out from
// under it — e.g. the db container restarting, a network blip. Without a
// listener, Node treats that as an uncaught exception and kills the whole
// process (confirmed empirically: `docker compose restart db` took the API
// down with it until `restart: unless-stopped` relaunched it). Log and
// carry on instead — the pool reconnects lazily on the next query.
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err);
});

export const db = drizzle(pool, { schema });
