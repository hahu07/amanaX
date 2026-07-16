import { queryActiveContracts, submitCreate, submitExercise, submitExerciseVoid, templateId } from "./commands.js";
import type { ProductType } from "./products.js";

// All four review-stage templates live in one Daml module
// (AmanaX.Review.Review) — see the module comment in Review.daml for why.
const SHARIAH_REQUEST_TEMPLATE_ID = templateId("AmanaX.Review.Review", "ShariahReviewRequest");
const SHARIAH_REVIEW_TEMPLATE_ID = templateId("AmanaX.Review.Review", "ShariahReview");
const TRUSTEE_REQUEST_TEMPLATE_ID = templateId("AmanaX.Review.Review", "TrusteeReviewRequest");
const TRUSTEE_REVIEW_TEMPLATE_ID = templateId("AmanaX.Review.Review", "TrusteeReview");

export interface ShariahReviewItem {
  contractId: string;
  status: "Pending" | "Certified";
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
  status: "Pending" | "Approved";
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

function toShariahReview(contractId: string, arg: unknown, status: "Pending" | "Certified"): ShariahReviewItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    status,
    issuingHouse: a.issuingHouse as string,
    shariahAdvisor: a.shariahAdvisor as string,
    sponsor: a.sponsor as string,
    structureCid: a.structureCid as string,
    productName: a.productName as string,
    description: a.description as string,
    structureType: a.structureType as ProductType,
    targetSizeNGN: Number(a.targetSizeNGN),
    tenorMonths: Number(a.tenorMonths),
    profitMechanism: a.profitMechanism as string,
    minSubscriptionNGN: Number(a.minSubscriptionNGN),
    redemptionTerms: a.redemptionTerms as string,
    certificationNotes: (a.certificationNotes as string) ?? "",
  };
}

function toTrusteeReview(contractId: string, arg: unknown, status: "Pending" | "Approved"): TrusteeReviewItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    status,
    issuingHouse: a.issuingHouse as string,
    trustee: a.trustee as string,
    sponsor: a.sponsor as string,
    structureCid: a.structureCid as string,
    shariahReviewCid: a.shariahReviewCid as string,
    productName: a.productName as string,
    description: a.description as string,
    structureType: a.structureType as ProductType,
    targetSizeNGN: Number(a.targetSizeNGN),
    tenorMonths: Number(a.tenorMonths),
    profitMechanism: a.profitMechanism as string,
    minSubscriptionNGN: Number(a.minSubscriptionNGN),
    redemptionTerms: a.redemptionTerms as string,
    certificationNotes: a.certificationNotes as string,
    approvalNotes: (a.approvalNotes as string) ?? "",
  };
}

// --- Shariah review ---

export async function submitForShariahReview(params: {
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
}): Promise<ShariahReviewItem> {
  const { contractId, createArgument } = await submitCreate({
    templateId: SHARIAH_REQUEST_TEMPLATE_ID,
    actAs: [params.issuingHouse],
    createArguments: {
      issuingHouse: params.issuingHouse,
      shariahAdvisor: params.shariahAdvisor,
      sponsor: params.sponsor,
      structureCid: params.structureCid,
      productName: params.productName,
      description: params.description,
      structureType: params.structureType,
      targetSizeNGN: params.targetSizeNGN.toString(),
      tenorMonths: params.tenorMonths.toString(),
      profitMechanism: params.profitMechanism,
      minSubscriptionNGN: params.minSubscriptionNGN.toString(),
      redemptionTerms: params.redemptionTerms,
    },
  });
  return toShariahReview(contractId, createArgument, "Pending");
}

export async function listShariahReviews(party: string): Promise<ShariahReviewItem[]> {
  const [pending, certified] = await Promise.all([
    queryActiveContracts({ party, templateFilterId: SHARIAH_REQUEST_TEMPLATE_ID }),
    queryActiveContracts({ party, templateFilterId: SHARIAH_REVIEW_TEMPLATE_ID }),
  ]);
  return [
    ...pending.map((c) => toShariahReview(c.contractId, c.createArgument, "Pending")),
    ...certified.map((c) => toShariahReview(c.contractId, c.createArgument, "Certified")),
  ];
}

export async function findShariahReviewById(party: string, contractId: string): Promise<ShariahReviewItem | undefined> {
  const reviews = await listShariahReviews(party);
  return reviews.find((r) => r.contractId === contractId);
}

export async function certifyShariahReview(params: {
  shariahAdvisor: string;
  contractId: string;
  certificationNotes: string;
}): Promise<ShariahReviewItem> {
  const { contractId, createArgument } = await submitExercise({
    templateId: SHARIAH_REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ShariahReviewRequest_Certify",
    actAs: [params.shariahAdvisor],
    choiceArgument: { certificationNotes: params.certificationNotes },
  });
  return toShariahReview(contractId, createArgument, "Certified");
}

export async function rejectShariahReview(params: { shariahAdvisor: string; contractId: string; rejectionReason: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: SHARIAH_REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ShariahReviewRequest_Reject",
    actAs: [params.shariahAdvisor],
    choiceArgument: { rejectionReason: params.rejectionReason },
  });
}

export async function withdrawShariahReview(params: { issuingHouse: string; contractId: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: SHARIAH_REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "ShariahReviewRequest_Withdraw",
    actAs: [params.issuingHouse],
  });
}

// --- Trustee review ---

export async function submitForTrusteeReview(params: {
  issuingHouse: string;
  shariahReviewContractId: string;
  trustee: string;
}): Promise<TrusteeReviewItem> {
  const { contractId, createArgument } = await submitExercise({
    templateId: SHARIAH_REVIEW_TEMPLATE_ID,
    contractId: params.shariahReviewContractId,
    choice: "ShariahReview_SubmitForTrusteeReview",
    actAs: [params.issuingHouse],
    choiceArgument: { trustee: params.trustee },
  });
  return toTrusteeReview(contractId, createArgument, "Pending");
}

export async function listTrusteeReviews(party: string): Promise<TrusteeReviewItem[]> {
  const [pending, approved] = await Promise.all([
    queryActiveContracts({ party, templateFilterId: TRUSTEE_REQUEST_TEMPLATE_ID }),
    queryActiveContracts({ party, templateFilterId: TRUSTEE_REVIEW_TEMPLATE_ID }),
  ]);
  return [
    ...pending.map((c) => toTrusteeReview(c.contractId, c.createArgument, "Pending")),
    ...approved.map((c) => toTrusteeReview(c.contractId, c.createArgument, "Approved")),
  ];
}

export async function findApprovedTrusteeReviewById(party: string, contractId: string): Promise<TrusteeReviewItem | undefined> {
  const contracts = await queryActiveContracts({ party, templateFilterId: TRUSTEE_REVIEW_TEMPLATE_ID });
  const approved = contracts.map((c) => toTrusteeReview(c.contractId, c.createArgument, "Approved"));
  return approved.find((r) => r.contractId === contractId);
}

export async function approveTrusteeReview(params: {
  trustee: string;
  contractId: string;
  approvalNotes: string;
}): Promise<TrusteeReviewItem> {
  const { contractId, createArgument } = await submitExercise({
    templateId: TRUSTEE_REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "TrusteeReviewRequest_Approve",
    actAs: [params.trustee],
    choiceArgument: { approvalNotes: params.approvalNotes },
  });
  return toTrusteeReview(contractId, createArgument, "Approved");
}

export async function rejectTrusteeReview(params: { trustee: string; contractId: string; rejectionReason: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: TRUSTEE_REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "TrusteeReviewRequest_Reject",
    actAs: [params.trustee],
    choiceArgument: { rejectionReason: params.rejectionReason },
  });
}

export async function withdrawTrusteeReview(params: { issuingHouse: string; contractId: string }): Promise<void> {
  await submitExerciseVoid({
    templateId: TRUSTEE_REQUEST_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "TrusteeReviewRequest_Withdraw",
    actAs: [params.issuingHouse],
  });
}
