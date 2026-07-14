import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import {
  PRODUCT_TYPES,
  createProposal,
  findProposalById,
  listProposals,
  rejectProposal,
  structureProposal,
  withdrawProposal,
} from "../ledger/products.js";
import { invokeIssuingHouseAssistant } from "../agents/client.js";

export const proposalsRouter = Router();

proposalsRouter.use(requireAuth);

const createProposalSchema = z.object({
  issuingHouse: z.string().min(1),
  productName: z.string().min(1),
  description: z.string().min(1),
  proposedType: z.enum(PRODUCT_TYPES),
  targetSizeNGN: z.number().positive(),
  tenorMonths: z.number().int().positive(),
});

proposalsRouter.post("/proposals", requireRole("FundManager"), async (req, res) => {
  const parsed = createProposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const proposal = await createProposal({ fundManager: requireOrgParty(req), ...parsed.data });
  res.status(201).json(proposal);
});

// Both sides of the propose-accept see the same list — the Fund Manager as
// signatory, the Issuing House as observer, so querying by "my org party"
// returns the right rows for either.
proposalsRouter.get("/proposals", requireRole("FundManager", "IssuingHouse"), async (req, res) => {
  const proposals = await listProposals(requireOrgParty(req));
  res.status(200).json(proposals);
});

proposalsRouter.post("/proposals/:contractId/withdraw", requireRole("FundManager"), async (req, res) => {
  await withdrawProposal({ fundManager: requireOrgParty(req), contractId: req.params.contractId });
  res.status(204).end();
});

proposalsRouter.post("/proposals/:contractId/reject", requireRole("IssuingHouse"), async (req, res) => {
  await rejectProposal({ issuingHouse: requireOrgParty(req), contractId: req.params.contractId });
  res.status(204).end();
});

// AI Product Structuring Agent (docs/implementation_plan.md §6.3) — the
// Issuing House's advisory recommendation before it commits initial
// structuring terms via ProductProposal_Structure. Never writes to the
// ledger itself; the response is a recommendation the Issuing House may
// accept, edit, or ignore when it actually submits the structure choice.
proposalsRouter.post("/proposals/:contractId/structuring-recommendation", requireRole("IssuingHouse"), async (req, res) => {
  const issuingHouse = requireOrgParty(req);
  const proposal = await findProposalById(issuingHouse, req.params.contractId);
  if (!proposal) {
    res.status(404).json({ error: "proposal not found" });
    return;
  }
  const recommendation = await invokeIssuingHouseAssistant({
    dealId: req.params.contractId,
    intent: "structure",
    context: {
      dealId: req.params.contractId,
      proposal: proposal as unknown as Record<string, unknown>,
      structure: null,
      shariahReview: null,
      trusteeReview: null,
      checklist: [],
      documents: [],
      priorRecommendations: [],
    },
  });
  res.status(200).json(recommendation);
});

const structureProposalSchema = z.object({
  structureType: z.enum(PRODUCT_TYPES),
  profitMechanism: z.string().min(1),
  minSubscriptionNGN: z.number().nonnegative(),
  redemptionTerms: z.string().min(1),
  structureTenorMonths: z.number().int().positive(),
});

proposalsRouter.post("/proposals/:contractId/structure", requireRole("IssuingHouse"), async (req, res) => {
  const parsed = structureProposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const structure = await structureProposal({
    issuingHouse: requireOrgParty(req),
    contractId: req.params.contractId,
    ...parsed.data,
  });
  res.status(201).json(structure);
});
