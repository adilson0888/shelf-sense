import "dotenv/config";
import cors from "cors";
import express from "express";
import { runMigrations } from "./db/migrate.js";
import { errorHandler } from "./lib/http-error.js";
import { healthRouter } from "./routes/health.js";
import { productsRouter } from "./routes/products.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// apps/web is served from its own origin (a different port in dev, a
// different host:port entirely once self-hosted — see apps/web/src/lib/
// api.ts's VITE_API_URL note), so browser fetch()s need CORS. No
// cookie/credentialed requests exist yet, so allowing any origin is safe —
// revisit if that changes (e.g. real auth lands).
app.use(cors());
app.use(express.json());
app.use("/health", healthRouter);
app.use("/products", productsRouter);

// Domain routes land here once specs define them — e.g. app.use("/shelves", shelvesRouter)

app.use(errorHandler);

// Migrations apply before the server starts accepting traffic — a
// self-hoster's whole upgrade action is `docker compose pull && up -d`, so
// this can't be a manual step. See specs/Persistence.md.
await runMigrations();

app.listen(port, () => {
  console.log(`shelf-sense-api listening on :${port}`);
});
