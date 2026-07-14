import { Router } from "express";
import { checkLedgerHealth } from "../ledger/health.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const ledger = await checkLedgerHealth();
  const status = ledger.reachable ? 200 : 503;
  res.status(status).json({ backend: "ok", ledger });
});
