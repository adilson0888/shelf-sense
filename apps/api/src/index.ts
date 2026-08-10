import express from "express";
import { healthRouter } from "./routes/health.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(express.json());
app.use("/health", healthRouter);

// Domain routes land here once specs define them — e.g. app.use("/shelves", shelvesRouter)

app.listen(port, () => {
  console.log(`shelf-sense-api listening on :${port}`);
});
