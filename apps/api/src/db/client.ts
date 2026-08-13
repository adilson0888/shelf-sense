import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required — see apps/api/.env.example");
}

export const pool = new Pool({ connectionString });

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
