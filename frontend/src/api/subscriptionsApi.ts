import { apiFetch } from "./backendClient";
import type { ProductType } from "./productsApi";
import type { InstrumentId } from "./investmentNotesApi";

export type SubscriptionStatus = "Pending" | "Allocated";

export interface SubscriptionItem {
  contractId: string;
  status: SubscriptionStatus;
  investor: string;
  distributor: string;
  issuingHouse: string;
  sponsor: string;
  noteCid: string;
  instrumentId: InstrumentId;
  symbol: string;
  productName: string;
  structureType: ProductType;
  tenorMonths: number;
  parValueNGN: number;
  targetSizeNGN: number;
  minSubscriptionNGN: number;
  amountNGN: number;
  units?: number;
  riskNotes?: string;
}

export interface RiskAssessment {
  concentrationPct: number;
  concentrationTier: "Low" | "Medium" | "High";
  productRiskTier: "Low" | "Medium" | "High";
  operationalFlags: string[];
  overallRisk: "Low" | "Medium" | "High";
  notes: string;
}

export interface RiskInvokeResponse {
  agent: "risk";
  output: RiskAssessment;
  model: string;
  timestamp: string;
}

export async function subscribeToNote(token: string, noteContractId: string, amountNGN: number): Promise<SubscriptionItem> {
  return apiFetch<SubscriptionItem>(`/investment-notes/${noteContractId}/subscribe`, token, {
    method: "POST",
    body: JSON.stringify({ amountNGN }),
  });
}

export async function listSubscriptions(token: string): Promise<SubscriptionItem[]> {
  return apiFetch<SubscriptionItem[]>("/subscriptions", token);
}

export async function riskCheckSubscription(token: string, contractId: string): Promise<RiskInvokeResponse> {
  return apiFetch<RiskInvokeResponse>(`/subscriptions/${contractId}/risk-check`, token, { method: "POST" });
}

export async function allocateSubscription(
  token: string,
  contractId: string,
  params: { allocatedAmountNGN: number; riskNotes: string },
): Promise<SubscriptionItem> {
  return apiFetch<SubscriptionItem>(`/subscriptions/${contractId}/allocate`, token, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function rejectSubscription(token: string, contractId: string, rejectionReason: string): Promise<void> {
  await apiFetch<void>(`/subscriptions/${contractId}/reject`, token, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function withdrawSubscription(token: string, contractId: string): Promise<void> {
  await apiFetch<void>(`/subscriptions/${contractId}/withdraw`, token, { method: "POST" });
}
