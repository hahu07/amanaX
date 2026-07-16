import { queryActiveContracts, submitCreate, submitExercise, submitExerciseVoid, templateId } from "./commands.js";
import type { ProductType } from "./products.js";

const SUBSCRIPTION_TEMPLATE_ID = templateId("AmanaX.Subscription.Subscription", "SubscriptionRequest");
const ALLOCATION_TEMPLATE_ID = templateId("AmanaX.Subscription.Subscription", "Allocation");

export interface InstrumentId {
  admin: string;
  id: string;
}

export interface SubscriptionItem {
  contractId: string;
  status: "Pending" | "Allocated";
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

function toInstrumentId(v: unknown): InstrumentId {
  const a = v as Record<string, unknown>;
  return { admin: a.admin as string, id: a.id as string };
}

function toPending(contractId: string, arg: unknown): SubscriptionItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    status: "Pending",
    investor: a.investor as string,
    distributor: a.distributor as string,
    issuingHouse: a.issuingHouse as string,
    sponsor: a.sponsor as string,
    noteCid: a.noteCid as string,
    instrumentId: toInstrumentId(a.instrumentId),
    symbol: a.symbol as string,
    productName: a.productName as string,
    structureType: a.structureType as ProductType,
    tenorMonths: Number(a.tenorMonths),
    parValueNGN: Number(a.parValueNGN),
    targetSizeNGN: Number(a.targetSizeNGN),
    minSubscriptionNGN: Number(a.minSubscriptionNGN),
    amountNGN: Number(a.amountNGN),
  };
}

function toAllocated(contractId: string, arg: unknown): SubscriptionItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    status: "Allocated",
    investor: a.investor as string,
    distributor: a.distributor as string,
    issuingHouse: a.issuingHouse as string,
    sponsor: a.sponsor as string,
    noteCid: a.subscriptionCid as string,
    instrumentId: toInstrumentId(a.instrumentId),
    symbol: a.symbol as string,
    productName: a.productName as string,
    structureType: a.structureType as ProductType,
    tenorMonths: Number(a.tenorMonths),
    parValueNGN: Number(a.parValueNGN),
    targetSizeNGN: 0,
    minSubscriptionNGN: 0,
    amountNGN: Number(a.amountNGN),
    units: Number(a.units),
    riskNotes: a.riskNotes as string,
  };
}

export async function createSubscriptionRequest(params: {
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
}): Promise<SubscriptionItem> {
  const { contractId, createArgument } = await submitCreate({
    templateId: SUBSCRIPTION_TEMPLATE_ID,
    actAs: [params.investor],
    createArguments: {
      investor: params.investor,
      distributor: params.distributor,
      issuingHouse: params.issuingHouse,
      sponsor: params.sponsor,
      noteCid: params.noteCid,
      instrumentId: params.instrumentId,
      symbol: params.symbol,
      productName: params.productName,
      structureType: params.structureType,
      tenorMonths: params.tenorMonths.toString(),
      parValueNGN: params.parValueNGN.toString(),
      targetSizeNGN: params.targetSizeNGN.toString(),
      minSubscriptionNGN: params.minSubscriptionNGN.toString(),
      amountNGN: params.amountNGN.toString(),
    },
  });
  return toPending(contractId, createArgument);
}

export async function listSubscriptions(party: string): Promise<SubscriptionItem[]> {
  const [pending, allocated] = await Promise.all([
    queryActiveContracts({ party, templateFilterId: SUBSCRIPTION_TEMPLATE_ID }),
    queryActiveContracts({ party, templateFilterId: ALLOCATION_TEMPLATE_ID }),
  ]);
  return [...pending.map((c) => toPending(c.contractId, c.createArgument)), ...allocated.map((c) => toAllocated(c.contractId, c.createArgument))];
}

export async function findSubscriptionById(party: string, contractId: string): Promise<SubscriptionItem | undefined> {
  const subs = await listSubscriptions(party);
  return subs.find((s) => s.contractId === contractId && s.status === "Pending");
}

// Sums every existing Allocation for the same instrument, regardless of
// which Distributor handled it — queried via issuingHouse, the one party
// that's an observer on every Allocation for notes it issued (Milestone 6
// Findings: no contract keys under LF 2.1, so this is a query-before-
// mutate check, not a ledger-enforced one, same as every other
// uniqueness/capacity guard in this codebase).
export async function sumAllocatedNGN(issuingHouse: string, instrumentId: InstrumentId): Promise<number> {
  const allocations = await listAllocationsForInstrument(issuingHouse, instrumentId);
  return allocations.reduce((sum, a) => sum + a.amountNGN, 0);
}

// Milestone 7: the full list (not just the sum) of every Allocation for an
// instrument, needed to compute each investor's pro-rata distribution
// share. Same "queried via issuingHouse" reasoning as sumAllocatedNGN.
export async function listAllocationsForInstrument(issuingHouse: string, instrumentId: InstrumentId): Promise<SubscriptionItem[]> {
  const contracts = await queryActiveContracts({ party: issuingHouse, templateFilterId: ALLOCATION_TEMPLATE_ID });
  return contracts
    .map((c) => toAllocated(c.contractId, c.createArgument))
    .filter((a) => a.instrumentId.admin === instrumentId.admin && a.instrumentId.id === instrumentId.id);
}

export async function allocateSubscription(params: {
  distributor: string;
  contractId: string;
  allocatedAmountNGN: number;
  riskNotes: string;
}): Promise<SubscriptionItem> {
  const { contractId, createArgument } = await submitExercise({
    templateId: SUBSCRIPTION_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "SubscriptionRequest_Allocate",
    actAs: [params.distributor],
    choiceArgument: { allocatedAmountNGN: params.allocatedAmountNGN.toString(), riskNotes: params.riskNotes },
  });
  return toAllocated(contractId, createArgument);
}

export async function rejectSubscription(params: { distributor: string; contractId: string; rejectionReason: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: SUBSCRIPTION_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "SubscriptionRequest_Reject",
    actAs: [params.distributor],
    choiceArgument: { rejectionReason: params.rejectionReason },
  });
}

export async function withdrawSubscription(params: { investor: string; contractId: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: SUBSCRIPTION_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "SubscriptionRequest_Withdraw",
    actAs: [params.investor],
  });
}
