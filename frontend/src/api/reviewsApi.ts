import { apiFetch } from "./backendClient";
import type { ProductType } from "./productsApi";

export type ShariahReviewStatus = "Pending" | "Certified";
export type TrusteeReviewStatus = "Pending" | "Approved";

export interface ShariahReviewItem {
  contractId: string;
  status: ShariahReviewStatus;
  issuingHouse: string;
  shariahAdvisor: string;
  sponsor: string;
  structureCid: string;
  productName: string;
  description: string;
  structureType: ProductType;
  targetSizeNGN: number;
  tenorMonths: number;
  profitMechanism: string;
  minSubscriptionNGN: number;
  redemptionTerms: string;
  certificationNotes: string;
}

export interface TrusteeReviewItem {
  contractId: string;
  status: TrusteeReviewStatus;
  issuingHouse: string;
  trustee: string;
  sponsor: string;
  structureCid: string;
  shariahReviewCid: string;
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
}

// docs/implementation_plan.md §6.3 — Compliance Agent output.
export interface ComplianceAssessment {
  readyForSubmission: boolean;
  missingDocuments: string[];
  shariahChecklistGaps: string[];
  workflowGaps: string[];
  blockingIssues: string[];
}

export interface ComplianceCheckResponse {
  agent: "compliance";
  output: ComplianceAssessment;
  model: string;
  timestamp: string;
}

// --- Shariah review ---

export async function submitForShariahReview(token: string, structureContractId: string, shariahAdvisor: string): Promise<ShariahReviewItem> {
  return apiFetch<ShariahReviewItem>(`/structures/${structureContractId}/submit-shariah-review`, token, {
    method: "POST",
    body: JSON.stringify({ shariahAdvisor }),
  });
}

export async function listShariahReviews(token: string): Promise<ShariahReviewItem[]> {
  return apiFetch<ShariahReviewItem[]>("/shariah-reviews", token);
}

export async function certifyShariahReview(token: string, contractId: string, certificationNotes: string): Promise<ShariahReviewItem> {
  return apiFetch<ShariahReviewItem>(`/shariah-reviews/${contractId}/certify`, token, {
    method: "POST",
    body: JSON.stringify({ certificationNotes }),
  });
}

export async function rejectShariahReview(token: string, contractId: string, rejectionReason: string): Promise<void> {
  await apiFetch<void>(`/shariah-reviews/${contractId}/reject`, token, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function withdrawShariahReview(token: string, contractId: string): Promise<void> {
  await apiFetch<void>(`/shariah-reviews/${contractId}/withdraw`, token, { method: "POST" });
}

export async function submitForTrusteeReview(token: string, shariahReviewContractId: string, trustee: string): Promise<TrusteeReviewItem> {
  return apiFetch<TrusteeReviewItem>(`/shariah-reviews/${shariahReviewContractId}/submit-trustee-review`, token, {
    method: "POST",
    body: JSON.stringify({ trustee }),
  });
}

// --- Trustee review ---

export async function listTrusteeReviews(token: string): Promise<TrusteeReviewItem[]> {
  return apiFetch<TrusteeReviewItem[]>("/trustee-reviews", token);
}

export async function approveTrusteeReview(token: string, contractId: string, approvalNotes: string): Promise<TrusteeReviewItem> {
  return apiFetch<TrusteeReviewItem>(`/trustee-reviews/${contractId}/approve`, token, {
    method: "POST",
    body: JSON.stringify({ approvalNotes }),
  });
}

export async function rejectTrusteeReview(token: string, contractId: string, rejectionReason: string): Promise<void> {
  await apiFetch<void>(`/trustee-reviews/${contractId}/reject`, token, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function withdrawTrusteeReview(token: string, contractId: string): Promise<void> {
  await apiFetch<void>(`/trustee-reviews/${contractId}/withdraw`, token, { method: "POST" });
}

export async function runComplianceCheck(token: string, trusteeReviewContractId: string): Promise<ComplianceCheckResponse> {
  return apiFetch<ComplianceCheckResponse>(`/trustee-reviews/${trusteeReviewContractId}/compliance-check`, token, { method: "POST" });
}
