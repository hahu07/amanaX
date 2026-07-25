import express, { type ErrorRequestHandler } from "express";
// Must be imported before any route below — see backend/src/index.ts's
// identical comment. Without this, an agent throwing (e.g. a malformed
// context that passes Zod but breaks a report builder) crashes the whole
// process instead of producing a 500 — a gap this service had that the
// backend already closed in Milestone 6.
import "express-async-errors";
import { AllocationRiskContextSchema, InvokeRequestSchema, ReportContextSchema } from "./types.js";
import { invokeIssuingHouseAssistant } from "./graph/issuingHouseAssistant.js";
import { runRiskAgent } from "./risk/agent.js";
import { runReportingAgent } from "./reporting/agent.js";
import { logger, requestLogger } from "./logging.js";

export const app = express();
app.use(express.json());
app.use(requestLogger);

// Optional defense-in-depth: this service has no auth of its own by design
// (§3.4 — reachable only from the backend, over a network path the frontend
// never gets), so the primary control is network isolation. When
// AGENTS_SHARED_SECRET is set (production), also require the backend to
// present it — see backend/src/config.ts's `agentsSharedSecret`. Unset
// (local dev default) skips the check entirely, so no header is required.
const internalSecret = process.env.AGENTS_SHARED_SECRET;
function requireInternalSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!internalSecret || req.header("X-Internal-Secret") === internalSecret) {
    next();
    return;
  }
  res.status(401).json({ error: "missing or invalid internal secret" });
}
app.use("/internal", requireInternalSecret);

// docs/implementation_plan.md §6.4 — single internal, intent-routed endpoint.
// No route here (or anywhere in this service) ever talks to the Ledger API;
// this process has no ledger client and no ledger credentials (§6.5).
app.post("/internal/assistant/issuing-house/invoke", async (req, res) => {
  const parsed = InvokeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const response = await invokeIssuingHouseAssistant(parsed.data);
  res.status(200).json(response);
});

// Milestone 6 — Risk Agent, invoked by the Distributor at allocation time
// (Step 13), not the Issuing House Assistant supervisor graph above — see
// the module comment on types.ts's AllocationRiskContextSchema for why.
app.post("/internal/risk/assess", async (req, res) => {
  const parsed = AllocationRiskContextSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const output = await runRiskAgent(parsed.data);
  res.status(200).json({ agent: "risk", output, model: "rule-based-v1", timestamp: new Date().toISOString() });
});

// Milestone 8 — Reporting Agent, called by multiple different personas
// (Issuing House, Investor, SEC, Trustee) for four different report
// kinds — not the Issuing House Assistant graph, same reasoning as the
// Risk Agent's dedicated route above.
app.post("/internal/reports/generate", async (req, res) => {
  const parsed = ReportContextSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const output = await runReportingAgent(parsed.data);
  res.status(200).json({ agent: "reporting", output, model: "rule-based-v1", timestamp: new Date().toISOString() });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ agents: "ok" });
});

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error("unhandled error", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: "internal server error", requestId: req.requestId });
};
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4100);
  app.listen(port, () => {
    logger.info("agents service listening", { port });
  });
}
