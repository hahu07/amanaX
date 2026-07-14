import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { healthRouter } from "./api/health.js";

export const app = express();
app.use(cors());
app.use(express.json());
app.use(healthRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`AmanaX backend listening on :${config.port} (ledger: ${config.ledgerApiUrl})`);
  });
}
