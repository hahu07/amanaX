import { apiFetch } from "./backendClient";
import type { ProductType } from "./productsApi";

export interface InstrumentId {
  admin: string;
  id: string;
}

export interface InvestmentNote {
  contractId: string;
  issuingHouse: string;
  sec: string;
  sponsor: string;
  trustee: string;
  approvalCid: string;
  instrumentId: InstrumentId;
  symbol: string;
  productName: string;
  description: string;
  structureType: ProductType;
  targetSizeNGN: number;
  tenorMonths: number;
  profitMechanism: string;
  minSubscriptionNGN: number;
  redemptionTerms: string;
  parValueNGN: number;
  totalSupply: number;
  meta: Record<string, string>;
  approvalReference: string;
  issuedAt: string;
}

export interface TokenMetadata {
  instrumentId: InstrumentId;
  meta: Record<string, string>;
}

export async function issueInvestmentNote(
  token: string,
  secApprovalContractId: string,
  params: { symbol: string; parValueNGN: number },
): Promise<InvestmentNote> {
  return apiFetch<InvestmentNote>(`/sec-approvals/${secApprovalContractId}/issue`, token, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listInvestmentNotes(token: string): Promise<InvestmentNote[]> {
  return apiFetch<InvestmentNote[]>("/investment-notes", token);
}

export async function getInvestmentNoteMetadata(token: string, contractId: string): Promise<TokenMetadata> {
  return apiFetch<TokenMetadata>(`/investment-notes/${contractId}/metadata`, token);
}
