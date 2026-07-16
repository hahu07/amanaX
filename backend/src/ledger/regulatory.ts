import { queryActiveContracts, submitCreate, submitExercise, submitExerciseVoid, templateId } from "./commands.js";
import type { ProductType } from "./products.js";

const SUBMISSION_TEMPLATE_ID = templateId("AmanaX.Regulatory.Regulatory", "RegulatorySubmission");
const APPROVAL_TEMPLATE_ID = templateId("AmanaX.Regulatory.Regulatory", "SECApproval");

export interface FilingDocument {
  kind: string;
  title: string;
  markdown: string;
}

export interface RegulatorySubmissionItem {
  contractId: string;
  status: "Pending" | "Approved";
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

function toSubmission(contractId: string, arg: unknown, status: "Pending" | "Approved"): RegulatorySubmissionItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    status,
    issuingHouse: a.issuingHouse as string,
    sec: a.sec as string,
    sponsor: a.sponsor as string,
    trustee: a.trustee as string,
    structureCid: a.structureCid as string,
    trusteeReviewCid: (a.trusteeReviewCid as string) ?? "",
    productName: a.productName as string,
    description: a.description as string,
    structureType: a.structureType as ProductType,
    targetSizeNGN: Number(a.targetSizeNGN),
    tenorMonths: Number(a.tenorMonths),
    profitMechanism: a.profitMechanism as string,
    minSubscriptionNGN: Number(a.minSubscriptionNGN),
    redemptionTerms: a.redemptionTerms as string,
    certificationNotes: a.certificationNotes as string,
    approvalNotes: a.approvalNotes as string,
    documents: (a.documents as FilingDocument[] | undefined) ?? [],
    approvalReference: a.approvalReference as string | undefined,
  };
}

export async function submitToSEC(params: {
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
}): Promise<RegulatorySubmissionItem> {
  const { contractId, createArgument } = await submitCreate({
    templateId: SUBMISSION_TEMPLATE_ID,
    actAs: [params.issuingHouse],
    createArguments: {
      issuingHouse: params.issuingHouse,
      sec: params.sec,
      sponsor: params.sponsor,
      trustee: params.trustee,
      structureCid: params.structureCid,
      trusteeReviewCid: params.trusteeReviewCid,
      productName: params.productName,
      description: params.description,
      structureType: params.structureType,
      targetSizeNGN: params.targetSizeNGN.toString(),
      tenorMonths: params.tenorMonths.toString(),
      profitMechanism: params.profitMechanism,
      minSubscriptionNGN: params.minSubscriptionNGN.toString(),
      redemptionTerms: params.redemptionTerms,
      certificationNotes: params.certificationNotes,
      approvalNotes: params.approvalNotes,
      documents: params.documents,
    },
  });
  return toSubmission(contractId, createArgument, "Pending");
}

export async function findApprovalById(party: string, contractId: string): Promise<RegulatorySubmissionItem | undefined> {
  const contracts = await queryActiveContracts({ party, templateFilterId: APPROVAL_TEMPLATE_ID });
  const approvals = contracts.map((c) => toSubmission(c.contractId, c.createArgument, "Approved"));
  return approvals.find((a) => a.contractId === contractId);
}

export async function listSubmissions(party: string): Promise<RegulatorySubmissionItem[]> {
  const [pending, approved] = await Promise.all([
    queryActiveContracts({ party, templateFilterId: SUBMISSION_TEMPLATE_ID }),
    queryActiveContracts({ party, templateFilterId: APPROVAL_TEMPLATE_ID }),
  ]);
  return [
    ...pending.map((c) => toSubmission(c.contractId, c.createArgument, "Pending")),
    ...approved.map((c) => toSubmission(c.contractId, c.createArgument, "Approved")),
  ];
}

export async function approveSubmission(params: { sec: string; contractId: string; approvalReference: string }): Promise<RegulatorySubmissionItem> {
  const { contractId, createArgument } = await submitExercise({
    templateId: SUBMISSION_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "RegulatorySubmission_Approve",
    actAs: [params.sec],
    choiceArgument: { approvalReference: params.approvalReference },
  });
  return toSubmission(contractId, createArgument, "Approved");
}

export async function rejectSubmission(params: { sec: string; contractId: string; rejectionReason: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: SUBMISSION_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "RegulatorySubmission_Reject",
    actAs: [params.sec],
    choiceArgument: { rejectionReason: params.rejectionReason },
  });
}

export async function withdrawSubmission(params: { issuingHouse: string; contractId: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: SUBMISSION_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "RegulatorySubmission_Withdraw",
    actAs: [params.issuingHouse],
  });
}
