import { apiFetch } from "./backendClient";
import type { ProductType } from "./productsApi";
import type { ComplianceAssessment } from "./reviewsApi";

export type RegulatorySubmissionStatus = "Pending" | "Approved";

export interface FilingDocument {
  kind: "TermSheet" | "InvestmentSummary" | "ApprovalPack" | "RegulatoryFiling";
  title: string;
  markdown: string;
}

export interface RegulatorySubmissionItem {
  contractId: string;
  status: RegulatorySubmissionStatus;
  issuingHouse: string;
  sec: string;
  sponsor: string;
  trustee: string;
  structureCid: string;
  trusteeReviewCid: string;
  productName: string;
  description: string;
  structureType: ProductType;
  targetSizeNGN: number;
  tenorMonths: number;
  profitMechanism: string;
  minSubscriptionNGN: number;
  redemptionTerms: string;
  certificationNotes: string;
  approvalNotes: string;
  documents: FilingDocument[];
  approvalReference?: string;
}

export interface FilingPackResponse {
  agent: "documentation";
  output: FilingDocument[];
  model: string;
  timestamp: string;
}

export interface ComplianceGateError {
  error: string;
  compliance: ComplianceAssessment;
}

export async function generateFilingPack(token: string, trusteeReviewContractId: string): Promise<FilingPackResponse> {
  return apiFetch<FilingPackResponse>(`/trustee-reviews/${trusteeReviewContractId}/generate-filing-pack`, token, { method: "POST" });
}

export async function submitToSEC(token: string, trusteeReviewContractId: string, sec: string): Promise<RegulatorySubmissionItem> {
  return apiFetch<RegulatorySubmissionItem>(`/trustee-reviews/${trusteeReviewContractId}/submit-to-sec`, token, {
    method: "POST",
    body: JSON.stringify({ sec }),
  });
}

export async function listRegulatorySubmissions(token: string): Promise<RegulatorySubmissionItem[]> {
  return apiFetch<RegulatorySubmissionItem[]>("/regulatory-submissions", token);
}

export async function approveRegulatorySubmission(token: string, contractId: string, approvalReference: string): Promise<RegulatorySubmissionItem> {
  return apiFetch<RegulatorySubmissionItem>(`/regulatory-submissions/${contractId}/approve`, token, {
    method: "POST",
    body: JSON.stringify({ approvalReference }),
  });
}

export async function rejectRegulatorySubmission(token: string, contractId: string, rejectionReason: string): Promise<void> {
  await apiFetch<void>(`/regulatory-submissions/${contractId}/reject`, token, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function withdrawRegulatorySubmission(token: string, contractId: string): Promise<void> {
  await apiFetch<void>(`/regulatory-submissions/${contractId}/withdraw`, token, { method: "POST" });
}
