import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { findApprovedTrusteeReviewById } from "../ledger/reviews.js";
import { approveSubmission, listSubmissions, rejectSubmission, submitToSEC, withdrawSubmission } from "../ledger/regulatory.js";
import { invokeIssuingHouseAssistant, type DealContext } from "../agents/client.js";

export const regulatoryRouter = Router();

// Mirrors agents/src/types.ts's ComplianceAssessmentSchema — kept as a
// local shape here (the same way api/reviews.ts proxies the assistant's
// response without importing the agents package) rather than a shared
// dependency between the two services.
interface ComplianceAssessment {
  readyForSubmission: boolean;
  missingDocuments: string[];
  shariahChecklistGaps: string[];
  workflowGaps: string[];
  blockingIssues: string[];
}

regulatoryRouter.use(requireAuth);

function buildDealContext(dealId: string, trusteeReview: Awaited<ReturnType<typeof findApprovedTrusteeReviewById>>): DealContext {
  if (!trusteeReview) {
    throw new Error("buildDealContext called without a trustee review");
  }
  return {
    dealId,
    proposal: null,
    structure: trusteeReview as unknown as Record<string, unknown>,
    shariahReview: { certificationNotes: trusteeReview.certificationNotes },
    trusteeReview: { approvalNotes: trusteeReview.approvalNotes },
    checklist: [],
    documents: [],
    priorRecommendations: [],
  };
}

// Preview: generate the filing pack without submitting anything, so the
// Issuing House can review it first (same "preview then commit" pattern as
// the Product Structuring Agent in Milestone 2).
regulatoryRouter.post("/trustee-reviews/:contractId/generate-filing-pack", requireRole("IssuingHouse"), async (req, res) => {
  const issuingHouse = requireOrgParty(req);
  const trusteeReview = await findApprovedTrusteeReviewById(issuingHouse, req.params.contractId);
  if (!trusteeReview) {
    res.status(404).json({ error: "approved trustee review not found" });
    return;
  }
  const response = await invokeIssuingHouseAssistant({
    dealId: req.params.contractId,
    intent: "generate-documents",
    context: buildDealContext(req.params.contractId, trusteeReview),
  });
  res.status(200).json(response);
});

const submitToSecSchema = z.object({ sec: z.string().min(1) });

// Step 8 (docs/prompt.md): submits the deal to the SEC. Re-runs the
// Compliance Agent server-side as a real gate (docs/milestones/milestone-3.md
// "Next" — this was a preview in Milestone 3, an actual gate here) rather
// than trusting a client-supplied "I checked and it's ready" — and
// regenerates the filing pack fresh rather than trusting client-supplied
// document content, for the same reason `sponsorType` is server-derived
// in api/proposals.ts.
regulatoryRouter.post("/trustee-reviews/:contractId/submit-to-sec", requireRole("IssuingHouse"), async (req, res) => {
  const parsed = submitToSecSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const issuingHouse = requireOrgParty(req);
  const trusteeReview = await findApprovedTrusteeReviewById(issuingHouse, req.params.contractId);
  if (!trusteeReview) {
    res.status(404).json({ error: "approved trustee review not found" });
    return;
  }

  const context = buildDealContext(req.params.contractId, trusteeReview);

  const complianceRes = await invokeIssuingHouseAssistant({
    dealId: req.params.contractId,
    intent: "assess-compliance",
    context,
  });
  const compliance = complianceRes.output as ComplianceAssessment;
  if (!compliance.readyForSubmission) {
    res.status(409).json({ error: "not ready for SEC submission", compliance });
    return;
  }

  const filingPackRes = await invokeIssuingHouseAssistant({
    dealId: req.params.contractId,
    intent: "generate-documents",
    context,
  });
  const documents = filingPackRes.output as { kind: string; title: string; markdown: string }[];

  const submission = await submitToSEC({
    issuingHouse,
    sec: parsed.data.sec,
    sponsor: trusteeReview.sponsor,
    trustee: trusteeReview.trustee,
    structureCid: trusteeReview.structureCid,
    trusteeReviewCid: trusteeReview.contractId,
    productName: trusteeReview.productName,
    description: trusteeReview.description,
    structureType: trusteeReview.structureType,
    targetSizeNGN: trusteeReview.targetSizeNGN,
    tenorMonths: trusteeReview.tenorMonths,
    profitMechanism: trusteeReview.profitMechanism,
    minSubscriptionNGN: trusteeReview.minSubscriptionNGN,
    redemptionTerms: trusteeReview.redemptionTerms,
    certificationNotes: trusteeReview.certificationNotes,
    approvalNotes: trusteeReview.approvalNotes,
    documents: documents.map((d) => ({ kind: d.kind, title: d.title, markdown: d.markdown })),
  });
  res.status(201).json(submission);
});

regulatoryRouter.get(
  "/regulatory-submissions",
  requireRole("IssuingHouse", "SEC", "FundManager", "Issuer", "Trustee"),
  async (req, res) => {
    const submissions = await listSubmissions(requireOrgParty(req));
    res.status(200).json(submissions);
  },
);

const approveSchema = z.object({ approvalReference: z.string().min(1) });

regulatoryRouter.post("/regulatory-submissions/:contractId/approve", requireRole("SEC"), async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const submission = await approveSubmission({
    sec: requireOrgParty(req),
    contractId: req.params.contractId,
    approvalReference: parsed.data.approvalReference,
  });
  res.status(200).json(submission);
});

const rejectSchema = z.object({ rejectionReason: z.string().min(1) });

regulatoryRouter.post("/regulatory-submissions/:contractId/reject", requireRole("SEC"), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await rejectSubmission({ sec: requireOrgParty(req), contractId: req.params.contractId, ...parsed.data });
  res.status(204).end();
});

regulatoryRouter.post("/regulatory-submissions/:contractId/withdraw", requireRole("IssuingHouse"), async (req, res) => {
  await withdrawSubmission({ issuingHouse: requireOrgParty(req), contractId: req.params.contractId });
  res.status(204).end();
});
