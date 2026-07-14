import { apiFetch } from "./backendClient";

export const PRODUCT_TYPES = ["Murabahah", "Ijarah", "Wakalah", "Mudarabah"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export type ProductStructureStatus = "ProductStructure_Draft" | "ProductStructure_Finalized";

export interface ProductProposal {
  contractId: string;
  fundManager: string;
  issuingHouse: string;
  productName: string;
  description: string;
  proposedType: ProductType;
  targetSizeNGN: number;
  tenorMonths: number;
}

export interface ProductStructure {
  contractId: string;
  fundManager: string;
  issuingHouse: string;
  productName: string;
  description: string;
  structureType: ProductType;
  targetSizeNGN: number;
  tenorMonths: number;
  profitMechanism: string;
  minSubscriptionNGN: number;
  redemptionTerms: string;
  status: ProductStructureStatus;
}

// docs/implementation_plan.md §6.3 — Product Structuring Agent output.
export interface StructuringRecommendation {
  recommendedStructureType: ProductType | "Hybrid";
  rationale: string;
  suggestedTerms: {
    tenorMonths: number;
    profitMechanism: string;
    minSubscriptionNGN: number;
    redemptionTerms: string;
  };
  openGaps: string[];
  confidence: "low" | "medium" | "high";
}

export interface AssistantRecommendationResponse {
  agent: "product-structuring";
  output: StructuringRecommendation;
  model: string;
  timestamp: string;
}

export async function listProposals(token: string): Promise<ProductProposal[]> {
  return apiFetch<ProductProposal[]>("/proposals", token);
}

export async function createProposal(
  token: string,
  params: {
    issuingHouse: string;
    productName: string;
    description: string;
    proposedType: ProductType;
    targetSizeNGN: number;
    tenorMonths: number;
  },
): Promise<ProductProposal> {
  return apiFetch<ProductProposal>("/proposals", token, { method: "POST", body: JSON.stringify(params) });
}

export async function withdrawProposal(token: string, contractId: string): Promise<void> {
  await apiFetch<void>(`/proposals/${contractId}/withdraw`, token, { method: "POST" });
}

export async function rejectProposal(token: string, contractId: string): Promise<void> {
  await apiFetch<void>(`/proposals/${contractId}/reject`, token, { method: "POST" });
}

export async function requestStructuringRecommendation(
  token: string,
  contractId: string,
): Promise<AssistantRecommendationResponse> {
  return apiFetch<AssistantRecommendationResponse>(`/proposals/${contractId}/structuring-recommendation`, token, {
    method: "POST",
  });
}

export async function structureProposal(
  token: string,
  contractId: string,
  params: {
    structureType: ProductType;
    profitMechanism: string;
    minSubscriptionNGN: number;
    redemptionTerms: string;
    structureTenorMonths: number;
  },
): Promise<ProductStructure> {
  return apiFetch<ProductStructure>(`/proposals/${contractId}/structure`, token, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listStructures(token: string): Promise<ProductStructure[]> {
  return apiFetch<ProductStructure[]>("/structures", token);
}

export async function updateStructureTerms(
  token: string,
  contractId: string,
  params: {
    newStructureType: ProductType;
    newProfitMechanism: string;
    newMinSubscriptionNGN: number;
    newRedemptionTerms: string;
    newTenorMonths: number;
  },
): Promise<ProductStructure> {
  return apiFetch<ProductStructure>(`/structures/${contractId}`, token, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export async function finalizeStructure(token: string, contractId: string): Promise<ProductStructure> {
  return apiFetch<ProductStructure>(`/structures/${contractId}/finalize`, token, { method: "POST" });
}
