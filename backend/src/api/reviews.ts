import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { findStructureById } from "../ledger/products.js";
import {
  approveTrusteeReview,
  certifyShariahReview,
  findApprovedTrusteeReviewById,
  findShariahReviewById,
  listShariahReviews,
  listTrusteeReviews,
  rejectShariahReview,
  rejectTrusteeReview,
  submitForShariahReview,
  submitForTrusteeReview,
  withdrawShariahReview,
  withdrawTrusteeReview,
} from "../ledger/reviews.js";
import { invokeIssuingHouseAssistant } from "../agents/client.js";
import { logAuditEvent } from "../ledger/auditLog.js";

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

// --- Shariah review ---

const submitShariahReviewSchema = z.object({ shariahAdvisor: z.string().min(1) });

// Step 5 (docs/prompt.md) starts here — a plain create, not a choice on
// ProductStructure (see the module comment in Review.daml for why). The
// "structure must be Finalized" rule is enforced here, backend-side, not
// on the ledger — a deliberate, documented trade-off.
reviewsRouter.post("/structures/:contractId/submit-shariah-review", requireRole("IssuingHouse"), async (req, res) => {
  const parsed = submitShariahReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const issuingHouse = requireOrgParty(req);
  const structure = await findStructureById(issuingHouse, req.params.contractId);
  if (!structure) {
    res.status(404).json({ error: "structure not found" });
    return;
  }
  if (structure.status !== "ProductStructure_Finalized") {
    res.status(409).json({ error: "structure must be Finalized before it can be submitted for Shariah review" });
    return;
  }
  const review = await submitForShariahReview({
    issuingHouse,
    shariahAdvisor: parsed.data.shariahAdvisor,
    sponsor: structure.sponsor,
    structureCid: structure.contractId,
    productName: structure.productName,
    description: structure.description,
    structureType: structure.structureType,
    targetSizeNGN: structure.targetSizeNGN,
    tenorMonths: structure.tenorMonths,
    profitMechanism: structure.profitMechanism,
    minSubscriptionNGN: structure.minSubscriptionNGN,
    redemptionTerms: structure.redemptionTerms,
  });
  res.status(201).json(review);
});

reviewsRouter.get("/shariah-reviews", requireRole("IssuingHouse", "ShariahAdvisor", "FundManager", "Issuer"), async (req, res) => {
  const reviews = await listShariahReviews(requireOrgParty(req));
  res.status(200).json(reviews);
});

const certifySchema = z.object({ certificationNotes: z.string().min(1) });

reviewsRouter.post("/shariah-reviews/:contractId/certify", requireRole("ShariahAdvisor"), async (req, res) => {
  const parsed = certifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const review = await certifyShariahReview({
    shariahAdvisor: requireOrgParty(req),
    contractId: req.params.contractId,
    certificationNotes: parsed.data.certificationNotes,
  });
  res.status(200).json(review);
});

const rejectSchema = z.object({ rejectionReason: z.string().min(1) });

reviewsRouter.post("/shariah-reviews/:contractId/reject", requireRole("ShariahAdvisor"), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await rejectShariahReview({ shariahAdvisor: requireOrgParty(req), contractId: req.params.contractId, ...parsed.data });
  res.status(204).end();
});

reviewsRouter.post("/shariah-reviews/:contractId/withdraw", requireRole("IssuingHouse"), async (req, res) => {
  await withdrawShariahReview({ issuingHouse: requireOrgParty(req), contractId: req.params.contractId });
  res.status(204).end();
});

const submitTrusteeReviewSchema = z.object({ trustee: z.string().min(1) });

// Step 6 — can only be exercised on a Certified ShariahReview, so Step 5
// can't be skipped (structurally, not just by convention).
reviewsRouter.post("/shariah-reviews/:contractId/submit-trustee-review", requireRole("IssuingHouse"), async (req, res) => {
  const parsed = submitTrusteeReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const issuingHouse = requireOrgParty(req);
  const shariahReview = await findShariahReviewById(issuingHouse, req.params.contractId);
  if (!shariahReview || shariahReview.status !== "Certified") {
    res.status(409).json({ error: "a Certified Shariah review is required before Trustee review can start" });
    return;
  }
  const review = await submitForTrusteeReview({
    issuingHouse,
    shariahReviewContractId: req.params.contractId,
    trustee: parsed.data.trustee,
  });
  res.status(201).json(review);
});

// --- Trustee review ---

reviewsRouter.get("/trustee-reviews", requireRole("IssuingHouse", "Trustee", "FundManager", "Issuer"), async (req, res) => {
  const reviews = await listTrusteeReviews(requireOrgParty(req));
  res.status(200).json(reviews);
});

const approveSchema = z.object({ approvalNotes: z.string().min(1) });

reviewsRouter.post("/trustee-reviews/:contractId/approve", requireRole("Trustee"), async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const review = await approveTrusteeReview({
    trustee: requireOrgParty(req),
    contractId: req.params.contractId,
    approvalNotes: parsed.data.approvalNotes,
  });
  res.status(200).json(review);
});

reviewsRouter.post("/trustee-reviews/:contractId/reject", requireRole("Trustee"), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await rejectTrusteeReview({ trustee: requireOrgParty(req), contractId: req.params.contractId, ...parsed.data });
  res.status(204).end();
});

reviewsRouter.post("/trustee-reviews/:contractId/withdraw", requireRole("IssuingHouse"), async (req, res) => {
  await withdrawTrusteeReview({ issuingHouse: requireOrgParty(req), contractId: req.params.contractId });
  res.status(204).end();
});

// AI Compliance Agent (docs/prompt.md Step 7) — only runs against an
// *approved* TrusteeReview (findApprovedTrusteeReviewById won't match a
// still-pending request), so the readiness check naturally can't happen
// before Step 6 completes.
reviewsRouter.post("/trustee-reviews/:contractId/compliance-check", requireRole("IssuingHouse"), async (req, res) => {
  const issuingHouse = requireOrgParty(req);
  const trusteeReview = await findApprovedTrusteeReviewById(issuingHouse, req.params.contractId);
  if (!trusteeReview) {
    res.status(404).json({ error: "approved trustee review not found" });
    return;
  }
  const assessment = await invokeIssuingHouseAssistant({
    dealId: req.params.contractId,
    intent: "assess-compliance",
    context: {
      dealId: req.params.contractId,
      proposal: null,
      structure: trusteeReview as unknown as Record<string, unknown>,
      shariahReview: { certificationNotes: trusteeReview.certificationNotes },
      trusteeReview: { approvalNotes: trusteeReview.approvalNotes },
      checklist: [],
      documents: [],
      priorRecommendations: [],
    },
  });
  await logAuditEvent({
    actor: issuingHouse,
    kind: "ComplianceCheckPerformed",
    agent: "compliance",
    summary: `Compliance check previewed for ${trusteeReview.productName}`,
    dealId: req.params.contractId,
  });
  res.status(200).json(assessment);
});
