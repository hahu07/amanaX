import type { DealContext, GeneratedDocument } from "../types.js";
import { GeneratedDocumentSchema } from "../types.js";

// Milestone 0 stub — see productStructuring/agent.ts. Fleshed out in
// Milestone 4 alongside regulatory submission.
export async function runDocumentationAgent(context: DealContext): Promise<GeneratedDocument> {
  const output: GeneratedDocument = {
    kind: "TermSheet",
    title: `Term Sheet — ${context.dealId}`,
    markdown: "_Milestone 0 placeholder — not yet backed by a model._",
    sourceFacts: [],
  };
  return GeneratedDocumentSchema.parse(output);
}
