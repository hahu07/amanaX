import express from "express";
import { InvokeRequestSchema } from "./types.js";
import { invokeIssuingHouseAssistant } from "./graph/issuingHouseAssistant.js";

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

app.get("/health", (_req, res) => {
  res.status(200).json({ agents: "ok" });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4100);
  app.listen(port, () => {
    console.log(`AmanaX agents service listening on :${port}`);
  });
}
