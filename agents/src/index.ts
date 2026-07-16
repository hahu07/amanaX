import express from "express";
import { AllocationRiskContextSchema, InvokeRequestSchema } from "./types.js";
import { invokeIssuingHouseAssistant } from "./graph/issuingHouseAssistant.js";
import { runRiskAgent } from "./risk/agent.js";

export const app = express();
app.use(express.json());

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

app.get("/health", (_req, res) => {
  res.status(200).json({ agents: "ok" });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4100);
  app.listen(port, () => {
    console.log(`AmanaX agents service listening on :${port}`);
  });
}
