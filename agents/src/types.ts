import { z } from "zod";

// Mirrors docs/implementation_plan.md §6.2 — assembled by the backend from
// ledger + off-ledger reads. The agents service never queries the ledger itself.
export const DealContextSchema = z.object({
  dealId: z.string(),
  proposal: z.record(z.unknown()).nullable(),
  structure: z.record(z.unknown()).nullable(),
  shariahReview: z.record(z.unknown()).nullable(),
  trusteeReview: z.record(z.unknown()).nullable(),
  checklist: z.array(z.record(z.unknown())).default([]),
  documents: z.array(z.record(z.unknown())).default([]),
  priorRecommendations: z.array(z.record(z.unknown())).default([]),
});
export type DealContext = z.infer<typeof DealContextSchema>;

// §6.3 — Product Structuring Agent output
export const StructuringRecommendationSchema = z.object({
  recommendedStructureType: z.enum(["Murabahah", "Ijarah", "Wakalah", "Mudarabah", "Hybrid"]),
  rationale: z.string(),
  suggestedTerms: z.object({
    tenorMonths: z.number(),
    profitMechanism: z.string(),
    minSubscriptionNGN: z.number(),
    redemptionTerms: z.string(),
  }),
  openGaps: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
});
export type StructuringRecommendation = z.infer<typeof StructuringRecommendationSchema>;

// §6.3 — Compliance Agent output
export const ComplianceAssessmentSchema = z.object({
  readyForSubmission: z.boolean(),
  missingDocuments: z.array(z.string()),
  shariahChecklistGaps: z.array(z.string()),
  workflowGaps: z.array(z.string()),
  blockingIssues: z.array(z.string()),
});
export type ComplianceAssessment = z.infer<typeof ComplianceAssessmentSchema>;

// §6.3 — Documentation Agent output
export const GeneratedDocumentSchema = z.object({
  kind: z.enum(["TermSheet", "InvestmentSummary", "ApprovalPack", "RegulatoryFiling"]),
  title: z.string(),
  markdown: z.string(),
  sourceFacts: z.array(z.string()),
});
export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;

export const IntentSchema = z.enum(["structure", "assess-compliance", "generate-documents"]);
export type Intent = z.infer<typeof IntentSchema>;

// §6.4 — backend <-> agents service contract
export const InvokeRequestSchema = z.object({
  dealId: z.string(),
  intent: IntentSchema,
  context: DealContextSchema,
});
export type InvokeRequest = z.infer<typeof InvokeRequestSchema>;

export type AgentName = "product-structuring" | "compliance" | "documentation";

export interface InvokeResponse {
  agent: AgentName;
  // The documentation agent returns the whole filing pack (term sheet,
  // investment summary, approval pack, regulatory filing) in one call —
  // docs/prompt.md's Documentation Agent is explicitly plural ("term
  // sheets, investment summaries, approval packs, regulatory filing
  // documents"), so this is an array, not a single document.
  output: StructuringRecommendation | ComplianceAssessment | GeneratedDocument[];
  model: string;
  timestamp: string;
}
