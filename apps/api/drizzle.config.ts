import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Only consumed by `npm run db:generate` (drizzle-kit generate), which
// diffs schema.ts against apps/api/drizzle/*.sql and writes the next
// migration file — see specs/Persistence.md's Non-functional section for
// why generated files are committed rather than auto-synced at runtime.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required (see apps/api/.env.example)");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
