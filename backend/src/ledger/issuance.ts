import { queryActiveContracts, submitCreate, templateId } from "./commands.js";
import type { ProductType } from "./products.js";

const NOTE_TEMPLATE_ID = templateId("AmanaX.Issuance.Issuance", "InvestmentNote");

// amanax.io/* well-known keys mirror
// daml/main/daml/AmanaX/Issuance/Issuance.daml's investmentNoteMetadata
// helper — kept in sync by hand since the backend never calls back into
// Daml to build this value (same "createCmd, not a choice" reasoning
// documented in that module).
export interface InvestmentNote {
  contractId: string;
  issuingHouse: string;
  operator: string;
  sec: string;
  sponsor: string;
  trustee: string;
  approvalCid: string;
  instrumentId: { admin: string; id: string };
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

function toNote(contractId: string, arg: unknown): InvestmentNote {
  const a = arg as Record<string, unknown>;
  const instrumentId = a.instrumentId as Record<string, unknown>;
  const meta = a.meta as Record<string, unknown>;
  return {
    contractId,
    issuingHouse: a.issuingHouse as string,
    operator: a.operator as string,
    sec: a.sec as string,
    sponsor: a.sponsor as string,
    trustee: a.trustee as string,
    approvalCid: a.approvalCid as string,
    instrumentId: { admin: instrumentId.admin as string, id: instrumentId.id as string },
    symbol: a.symbol as string,
    productName: a.productName as string,
    description: a.description as string,
    structureType: a.structureType as ProductType,
    targetSizeNGN: Number(a.targetSizeNGN),
    tenorMonths: Number(a.tenorMonths),
    profitMechanism: a.profitMechanism as string,
    minSubscriptionNGN: Number(a.minSubscriptionNGN),
    redemptionTerms: a.redemptionTerms as string,
    parValueNGN: Number(a.parValueNGN),
    totalSupply: Number(a.totalSupply),
    meta: (meta.values as Record<string, string>) ?? {},
    approvalReference: a.approvalReference as string,
    issuedAt: a.issuedAt as string,
  };
}

export async function listNotes(party: string): Promise<InvestmentNote[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: NOTE_TEMPLATE_ID });
  return contracts.map((c) => toNote(c.contractId, c.createArgument));
}

// No contract keys under LF 2.1 (§2 of docs/implementation_plan.md), so
// "one InvestmentNote per SECApproval" and "unique symbol per Issuing
// House" (HoldingV1.daml's own doc comment on InstrumentId) are both
// query-before-mutate checks here, not ledger-enforced constraints — the
// same trade-off already made for "already submitted for review" guards
// in api/reviews.ts and api/regulatory.ts.
export async function findNoteByApprovalCid(issuingHouse: string, approvalCid: string): Promise<InvestmentNote | undefined> {
  const notes = await listNotes(issuingHouse);
  return notes.find((n) => n.approvalCid === approvalCid);
}

export async function findNoteBySymbol(issuingHouse: string, symbol: string): Promise<InvestmentNote | undefined> {
  const notes = await listNotes(issuingHouse);
  return notes.find((n) => n.symbol === symbol);
}

export async function issueNote(params: {
  issuingHouse: string;
  operator: string;
  sec: string;
  sponsor: string;
  trustee: string;
  approvalCid: string;
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
  approvalReference: string;
}): Promise<InvestmentNote> {
  const totalSupply = params.targetSizeNGN / params.parValueNGN;
  const meta = {
    "amanax.io/name": params.productName,
    "amanax.io/symbol": params.symbol,
    "amanax.io/structureType": params.structureType,
    "amanax.io/totalSupply": totalSupply.toString(),
    "amanax.io/parValueNGN": params.parValueNGN.toString(),
    "amanax.io/tenorMonths": params.tenorMonths.toString(),
  };
  const { contractId, createArgument } = await submitCreate({
    templateId: NOTE_TEMPLATE_ID,
    actAs: [params.issuingHouse],
    createArguments: {
      issuingHouse: params.issuingHouse,
      operator: params.operator,
      sec: params.sec,
      sponsor: params.sponsor,
      trustee: params.trustee,
      approvalCid: params.approvalCid,
      instrumentId: { admin: params.issuingHouse, id: params.symbol },
      symbol: params.symbol,
      productName: params.productName,
      description: params.description,
      structureType: params.structureType,
      targetSizeNGN: params.targetSizeNGN.toString(),
      tenorMonths: params.tenorMonths.toString(),
      profitMechanism: params.profitMechanism,
      minSubscriptionNGN: params.minSubscriptionNGN.toString(),
      redemptionTerms: params.redemptionTerms,
      parValueNGN: params.parValueNGN.toString(),
      totalSupply: totalSupply.toString(),
      meta: { values: meta },
      approvalReference: params.approvalReference,
      issuedAt: new Date().toISOString(),
    },
  });
  return toNote(contractId, createArgument);
}
