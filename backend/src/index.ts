import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { healthRouter } from "./api/health.js";
import { authRouter } from "./api/auth.js";
import { orgsRouter } from "./api/orgs.js";

export const app = express();
app.use(cors());
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(orgsRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`AmanaX backend listening on :${config.port} (ledger: ${config.ledgerApiUrl})`);
  });
}
