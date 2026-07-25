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

// Milestone 6 — Risk Agent input. A deliberately flatter, different shape
// from DealContext: the Risk Agent runs at a different workflow step
// (Step 13, allocation) for a different persona (Distributor, not Issuing
// House), so it doesn't go through the Issuing House Assistant's
// supervisor graph — see agents/src/index.ts's dedicated
// /internal/risk/assess route and docs/milestones/milestone-6.md Findings.
export const AllocationRiskContextSchema = z.object({
  structureType: z.enum(["Murabahah", "Ijarah", "Wakalah", "Mudarabah"]),
  tenorMonths: z.number(),
  targetSizeNGN: z.number(),
  minSubscriptionNGN: z.number(),
  requestedAmountNGN: z.number(),
  alreadyAllocatedNGN: z.number(),
});
export type AllocationRiskContext = z.infer<typeof AllocationRiskContextSchema>;

const RiskTierSchema = z.enum(["Low", "Medium", "High"]);

// docs/prompt.md's Risk Agent: "product risk assessment, operational risk
// review, concentration analysis." Advisory only — unlike the Compliance
// Agent (a real submission gate since Milestone 4), nothing in the
// backend blocks on this output; it's surfaced to the Distributor as a
// recommendation before they decide the allocated amount.
export const RiskAssessmentSchema = z.object({
  concentrationPct: z.number(),
  concentrationTier: RiskTierSchema,
  productRiskTier: RiskTierSchema,
  operationalFlags: z.array(z.string()),
  overallRisk: RiskTierSchema,
  notes: z.string(),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// Milestone 8 — Reporting Agent. docs/prompt.md: "Generates: management
// reports, investor reports, compliance reports, regulatory reports."
// One flexible context shape covers all four — `holdings`/`distributions`
// are reused as "this deal's subscriptions/distributions" for
// management/regulatory reports and as "this investor's own holdings/
// distributions across every note" for investor reports; the per-deal
// fields (productName, symbol, ...) are simply absent for the
// portfolio-wide investor report. Same "backend assembles context, agent
// never touches the ledger" pattern as DealContext.
//
// Milestone 9 (post-hardening pass) — four more report kinds, one per
// remaining role whose dashboard shipped with a disabled "Reports" tab:
// "portfolio" (Distributor: their book of investors and allocations),
// "custody" (Custodian: notes and distributions they administer),
// "shariah" (Shariah Advisor: their certification history), "platform"
// (Platform Operator: network-wide org/user counts). Each is scoped by
// the caller's own party the same way management/investor/regulatory
// already are — the backend assembles the context from whatever ledger
// reads that party is naturally a stakeholder on; no new privacy surface.
export const ReportTypeSchema = z.enum(["management", "investor", "compliance", "regulatory", "portfolio", "custody", "shariah", "platform"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportContextSchema = z.object({
  reportType: ReportTypeSchema,
  dealId: z.string(),
  generatedFor: z.string().optional(),
  productName: z.string().optional(),
  symbol: z.string().optional(),
  structureType: z.string().optional(),
  targetSizeNGN: z.number().optional(),
  totalSupply: z.number().optional(),
  approvalReference: z.string().optional(),
  certificationNotes: z.string().optional(),
  approvalNotes: z.string().optional(),
  compliance: ComplianceAssessmentSchema.nullable().optional(),
  holdings: z.array(z.record(z.unknown())).default([]),
  distributions: z.array(z.record(z.unknown())).default([]),
  // "portfolio" (Distributor's own investor profiles)
  investorProfiles: z.array(z.record(z.unknown())).default([]),
  // "custody" (Custodian's own issued notes + distribution requests)
  investmentNotes: z.array(z.record(z.unknown())).default([]),
  distributionRequests: z.array(z.record(z.unknown())).default([]),
  // "shariah" (Shariah Advisor's own review history)
  shariahReviews: z.array(z.record(z.unknown())).default([]),
  // "platform" (Operator's network-wide view)
  organizations: z.array(z.record(z.unknown())).default([]),
  users: z.array(z.record(z.unknown())).default([]),
});
export type ReportContext = z.infer<typeof ReportContextSchema>;

export const GeneratedReportSchema = z.object({
  reportType: ReportTypeSchema,
  title: z.string(),
  markdown: z.string(),
  sourceFacts: z.array(z.string()),
});
export type GeneratedReport = z.infer<typeof GeneratedReportSchema>;

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
