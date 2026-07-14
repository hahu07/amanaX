import { queryActiveContracts, submitCreate, submitExercise, submitExerciseVoid, templateId } from "./commands.js";

export const PRODUCT_TYPES = ["Murabahah", "Ijarah", "Wakalah", "Mudarabah"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export type ProductStructureStatus = "ProductStructure_Draft" | "ProductStructure_Finalized";

const PROPOSAL_TEMPLATE_ID = templateId("AmanaX.Product.ProductProposal", "ProductProposal");
const STRUCTURE_TEMPLATE_ID = templateId("AmanaX.Product.ProductStructure", "ProductStructure");

// The JSON Ledger API rejects both Decimal and Int fields sent as raw JSON
// numbers ("Expected ujson.Str") — both need `.toString()` in
// createArguments/choiceArgument, same as the Decimal fields already do.

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

function toProposal(contractId: string, arg: unknown): ProductProposal {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    fundManager: a.fundManager as string,
    issuingHouse: a.issuingHouse as string,
    productName: a.productName as string,
    description: a.description as string,
    proposedType: a.proposedType as ProductType,
    targetSizeNGN: Number(a.targetSizeNGN),
    tenorMonths: Number(a.tenorMonths),
  };
}

function toStructure(contractId: string, arg: unknown): ProductStructure {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    fundManager: a.fundManager as string,
    issuingHouse: a.issuingHouse as string,
    productName: a.productName as string,
    description: a.description as string,
    structureType: a.structureType as ProductType,
    targetSizeNGN: Number(a.targetSizeNGN),
    tenorMonths: Number(a.tenorMonths),
    profitMechanism: a.profitMechanism as string,
    minSubscriptionNGN: Number(a.minSubscriptionNGN),
    redemptionTerms: a.redemptionTerms as string,
    status: a.status as ProductStructureStatus,
  };
}

export async function createProposal(params: {
  fundManager: string;
  issuingHouse: string;
  productName: string;
  description: string;
  proposedType: ProductType;
  targetSizeNGN: number;
  tenorMonths: number;
}): Promise<ProductProposal> {
  const { contractId, createArgument } = await submitCreate({
    templateId: PROPOSAL_TEMPLATE_ID,
    actAs: [params.fundManager],
    createArguments: {
      fundManager: params.fundManager,
      issuingHouse: params.issuingHouse,
      productName: params.productName,
      description: params.description,
      proposedType: params.proposedType,
      targetSizeNGN: params.targetSizeNGN.toString(),
      tenorMonths: params.tenorMonths.toString(),
    },
  });
  return toProposal(contractId, createArgument);
}

export async function listProposals(party: string): Promise<ProductProposal[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: PROPOSAL_TEMPLATE_ID });
  return contracts.map((c) => toProposal(c.contractId, c.createArgument));
}

export async function findProposalById(party: string, contractId: string): Promise<ProductProposal | undefined> {
  const proposals = await listProposals(party);
  return proposals.find((p) => p.contractId === contractId);
}

export async function withdrawProposal(params: { fundManager: string; contractId: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: PROPOSAL_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ProductProposal_Withdraw",
    actAs: [params.fundManager],
  });
}

export async function rejectProposal(params: { issuingHouse: string; contractId: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: PROPOSAL_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ProductProposal_Reject",
    actAs: [params.issuingHouse],
  });
}

export async function structureProposal(params: {
  issuingHouse: string;
  contractId: string;
  structureType: ProductType;
  profitMechanism: string;
  minSubscriptionNGN: number;
  redemptionTerms: string;
  structureTenorMonths: number;
}): Promise<ProductStructure> {
  const { contractId, createArgument } = await submitExercise({
    templateId: PROPOSAL_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ProductProposal_Structure",
    actAs: [params.issuingHouse],
    choiceArgument: {
      structureType: params.structureType,
      profitMechanism: params.profitMechanism,
      minSubscriptionNGN: params.minSubscriptionNGN.toString(),
      redemptionTerms: params.redemptionTerms,
      structureTenorMonths: params.structureTenorMonths.toString(),
    },
  });
  return toStructure(contractId, createArgument);
}

export async function listStructures(party: string): Promise<ProductStructure[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: STRUCTURE_TEMPLATE_ID });
  return contracts.map((c) => toStructure(c.contractId, c.createArgument));
}

export async function updateStructureTerms(params: {
  issuingHouse: string;
  contractId: string;
  newStructureType: ProductType;
  newProfitMechanism: string;
  newMinSubscriptionNGN: number;
  newRedemptionTerms: string;
  newTenorMonths: number;
}): Promise<ProductStructure> {
  const { contractId, createArgument } = await submitExercise({
    templateId: STRUCTURE_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ProductStructure_UpdateTerms",
    actAs: [params.issuingHouse],
    choiceArgument: {
      newStructureType: params.newStructureType,
      newProfitMechanism: params.newProfitMechanism,
      newMinSubscriptionNGN: params.newMinSubscriptionNGN.toString(),
      newRedemptionTerms: params.newRedemptionTerms,
      newTenorMonths: params.newTenorMonths.toString(),
    },
  });
  return toStructure(contractId, createArgument);
}

export async function finalizeStructure(params: { issuingHouse: string; contractId: string }): Promise<ProductStructure> {
  const { contractId, createArgument } = await submitExercise({
    templateId: STRUCTURE_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ProductStructure_Finalize",
    actAs: [params.issuingHouse],
  });
  return toStructure(contractId, createArgument);
}
