import { queryActiveContracts, submitCreate, submitExerciseMulti, submitExerciseVoid, templateId } from "./commands.js";
import type { InstrumentId } from "./subscriptions.js";

const REQUEST_TEMPLATE_ID = templateId("AmanaX.Distribution.Distribution", "DistributionRequest");
const DISTRIBUTION_TEMPLATE_ID = templateId("AmanaX.Distribution.Distribution", "ProfitDistribution");

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

function toInstrumentId(v: unknown): InstrumentId {
  const a = v as Record<string, unknown>;
  return { admin: a.admin as string, id: a.id as string };
}

function toShare(v: unknown): DistributionShare {
  const a = v as Record<string, unknown>;
  return { investor: a.investor as string, units: Number(a.units), amountNGN: Number(a.amountNGN) };
}

function toRequest(contractId: string, arg: unknown): DistributionRequestItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    custodian: a.custodian as string,
    trustee: a.trustee as string,
    issuingHouse: a.issuingHouse as string,
    sponsor: a.sponsor as string,
    instrumentId: toInstrumentId(a.instrumentId),
    symbol: a.symbol as string,
    productName: a.productName as string,
    periodLabel: a.periodLabel as string,
    totalAmountNGN: Number(a.totalAmountNGN),
    shares: ((a.shares as unknown[]) ?? []).map(toShare),
  };
}

function toDistribution(contractId: string, arg: unknown): ProfitDistributionItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    custodian: a.custodian as string,
    trustee: a.trustee as string,
    issuingHouse: a.issuingHouse as string,
    sponsor: a.sponsor as string,
    investor: a.investor as string,
    instrumentId: toInstrumentId(a.instrumentId),
    symbol: a.symbol as string,
    productName: a.productName as string,
    periodLabel: a.periodLabel as string,
    units: Number(a.units),
    amountNGN: Number(a.amountNGN),
    totalAmountNGN: Number(a.totalAmountNGN),
  };
}

export async function createDistributionRequest(params: {
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
}): Promise<DistributionRequestItem> {
  const { contractId, createArgument } = await submitCreate({
    templateId: REQUEST_TEMPLATE_ID,
    actAs: [params.custodian],
    createArguments: {
      custodian: params.custodian,
      trustee: params.trustee,
      issuingHouse: params.issuingHouse,
      sponsor: params.sponsor,
      instrumentId: params.instrumentId,
      symbol: params.symbol,
      productName: params.productName,
      periodLabel: params.periodLabel,
      totalAmountNGN: params.totalAmountNGN.toString(),
      shares: params.shares.map((s) => ({ investor: s.investor, units: s.units.toString(), amountNGN: s.amountNGN.toString() })),
    },
  });
  return toRequest(contractId, createArgument);
}

export async function listDistributionRequests(party: string): Promise<DistributionRequestItem[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: REQUEST_TEMPLATE_ID });
  return contracts.map((c) => toRequest(c.contractId, c.createArgument));
}

export async function findDistributionRequestById(party: string, contractId: string): Promise<DistributionRequestItem | undefined> {
  const requests = await listDistributionRequests(party);
  return requests.find((r) => r.contractId === contractId);
}

export async function approveDistributionRequest(params: { trustee: string; contractId: string }): Promise<ProfitDistributionItem[]> {
  const created = await submitExerciseMulti({
    templateId: REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "DistributionRequest_Approve",
    actAs: [params.trustee],
  });
  return created.map((c) => toDistribution(c.contractId, c.createArgument));
}

export async function rejectDistributionRequest(params: { trustee: string; contractId: string; rejectionReason: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "DistributionRequest_Reject",
    actAs: [params.trustee],
    choiceArgument: { rejectionReason: params.rejectionReason },
  });
}

export async function withdrawDistributionRequest(params: { custodian: string; contractId: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "DistributionRequest_Withdraw",
    actAs: [params.custodian],
  });
}

export async function listProfitDistributions(party: string): Promise<ProfitDistributionItem[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: DISTRIBUTION_TEMPLATE_ID });
  return contracts.map((c) => toDistribution(c.contractId, c.createArgument));
}
