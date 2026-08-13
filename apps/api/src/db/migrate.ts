import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * Applies any pending migrations from ./drizzle (generated via
 * `npm run db:generate`, committed to the repo) before the API starts
 * accepting traffic — see specs/Persistence.md's Non-functional section:
 * a self-hoster's whole upgrade action is `docker compose pull && up -d`,
 * so this has to run automatically on boot rather than as a manual step.
 * Idempotent — drizzle tracks applied migrations in its own table, so this
 * is safe to run on every restart, not just upgrades.
 */
export async function runMigrations(): Promise<void> {
  try {
    await migrate(db, { migrationsFolder });
    console.log("Database migrations up to date.");
  } catch (err) {
    // Fail fast and loud rather than start serving against a half-migrated
    // schema — visible via `docker logs`, per specs/Persistence.md.
    console.error("Database migration failed:", err);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}
