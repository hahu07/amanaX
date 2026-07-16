import { apiFetch } from "./backendClient";
import type { InstrumentId } from "./investmentNotesApi";

export interface DistributionShare {
  investor: string;
  units: number;
  amountNGN: number;
}

export interface DistributionRequestItem {
  contractId: string;
  custodian: string;
  trustee: string;
  issuingHouse: string;
  sponsor: string;
  instrumentId: InstrumentId;
  symbol: string;
  productName: string;
  periodLabel: string;
  totalAmountNGN: number;
  shares: DistributionShare[];
}

export interface ProfitDistributionItem {
  contractId: string;
  custodian: string;
  trustee: string;
  issuingHouse: string;
  sponsor: string;
  investor: string;
  instrumentId: InstrumentId;
  symbol: string;
  productName: string;
  periodLabel: string;
  units: number;
  amountNGN: number;
  totalAmountNGN: number;
}

export async function proposeDistribution(
  token: string,
  noteContractId: string,
  params: { periodLabel: string; totalAmountNGN: number },
): Promise<DistributionRequestItem> {
  return apiFetch<DistributionRequestItem>(`/investment-notes/${noteContractId}/distributions`, token, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listDistributionRequests(token: string): Promise<DistributionRequestItem[]> {
  return apiFetch<DistributionRequestItem[]>("/distribution-requests", token);
}

export async function approveDistributionRequest(token: string, contractId: string): Promise<ProfitDistributionItem[]> {
  return apiFetch<ProfitDistributionItem[]>(`/distribution-requests/${contractId}/approve`, token, { method: "POST" });
}

export async function rejectDistributionRequest(token: string, contractId: string, rejectionReason: string): Promise<void> {
  await apiFetch<void>(`/distribution-requests/${contractId}/reject`, token, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function withdrawDistributionRequest(token: string, contractId: string): Promise<void> {
  await apiFetch<void>(`/distribution-requests/${contractId}/withdraw`, token, { method: "POST" });
}

export async function listProfitDistributions(token: string): Promise<ProfitDistributionItem[]> {
  return apiFetch<ProfitDistributionItem[]>("/profit-distributions", token);
}
