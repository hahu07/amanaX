import { config } from "../config.js";

// docs/implementation_plan.md §6.4 — the backend decides when to call the
// assistant and owns building DealContext; the agents service never reads
// the ledger itself. Recommendations aren't persisted yet (no backend/src/db
// exists — see docs/milestones/milestone-2.md): the response is proxied
// straight back to the frontend for display. Persisting
// `priorRecommendations` for audit is deferred to whichever milestone adds
// off-ledger storage.
export interface DealContext {
  dealId: string;
  proposal: Record<string, unknown> | null;
  structure: Record<string, unknown> | null;
  shariahReview: Record<string, unknown> | null;
  trusteeReview: Record<string, unknown> | null;
  checklist: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  priorRecommendations: Record<string, unknown>[];
}

export interface InvokeResponse {
  agent: "product-structuring" | "compliance" | "documentation";
  output: unknown;
  model: string;
  timestamp: string;
}

export async function invokeIssuingHouseAssistant(params: {
  dealId: string;
  intent: "structure" | "assess-compliance" | "generate-documents";
  context: DealContext;
}): Promise<InvokeResponse> {
  const res = await fetch(`${config.agentsServiceUrl}/internal/assistant/issuing-house/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`agents service returned ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as InvokeResponse;
}

// Milestone 6 — Risk Agent, a separate call from the Issuing House
// Assistant above (different persona/workflow step; see the module
// comment on agents/src/types.ts's AllocationRiskContextSchema).
export interface AllocationRiskContext {
  structureType: "Murabahah" | "Ijarah" | "Wakalah" | "Mudarabah";
  tenorMonths: number;
  targetSizeNGN: number;
  minSubscriptionNGN: number;
  requestedAmountNGN: number;
  alreadyAllocatedNGN: number;
}

export interface RiskInvokeResponse {
  agent: "risk";
  output: unknown;
  model: string;
  timestamp: string;
}

export async function invokeRiskAgent(context: AllocationRiskContext): Promise<RiskInvokeResponse> {
  const res = await fetch(`${config.agentsServiceUrl}/internal/risk/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });
  if (!res.ok) {
    throw new Error(`agents service returned ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as RiskInvokeResponse;
}

// Milestone 8 — Reporting Agent, called by four different personas for
// four different report kinds; see the module comment on
// agents/src/types.ts's ReportContextSchema.
export interface ComplianceAssessment {
  readyForSubmission: boolean;
  missingDocuments: string[];
  shariahChecklistGaps: string[];
  workflowGaps: string[];
  blockingIssues: string[];
}

export interface ReportContext {
  reportType: "management" | "investor" | "compliance" | "regulatory";
  dealId: string;
  generatedFor?: string;
  productName?: string;
  symbol?: string;
  structureType?: string;
  targetSizeNGN?: number;
  totalSupply?: number;
  approvalReference?: string;
  certificationNotes?: string;
  approvalNotes?: string;
  compliance?: ComplianceAssessment | null;
  holdings?: Record<string, unknown>[];
  distributions?: Record<string, unknown>[];
}

export interface ReportInvokeResponse {
  agent: "reporting";
  output: unknown;
  model: string;
  timestamp: string;
}

export async function invokeReportingAgent(context: ReportContext): Promise<ReportInvokeResponse> {
  const res = await fetch(`${config.agentsServiceUrl}/internal/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });
  if (!res.ok) {
    throw new Error(`agents service returned ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as ReportInvokeResponse;
}
