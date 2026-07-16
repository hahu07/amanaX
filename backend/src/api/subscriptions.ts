import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { getOperatorParty } from "../ledger/operator.js";
import { listInvestorProfiles } from "../ledger/investors.js";
import { listNotes } from "../ledger/issuance.js";
import {
  allocateSubscription,
  createSubscriptionRequest,
  findSubscriptionById,
  listSubscriptions,
  rejectSubscription,
  sumAllocatedNGN,
  withdrawSubscription,
} from "../ledger/subscriptions.js";
import { invokeRiskAgent } from "../agents/client.js";

export const subscriptionsRouter = Router();

subscriptionsRouter.use(requireAuth);

const subscribeSchema = z.object({ amountNGN: z.number().positive() });

// Step 12 (docs/prompt.md): re-derives every deal fact from the on-ledger
// InvestmentNote (browsed via the Operator's party — see
// api/issuance.ts's readerParty) and the investor's own distributor from
// their own InvestorProfile, never trusting client-supplied values — same
// reasoning as sponsorType in api/proposals.ts.
subscriptionsRouter.post("/investment-notes/:contractId/subscribe", requireRole("Investor"), async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const investor = requireOrgParty(req);
  const profiles = await listInvestorProfiles(investor);
  const verifiedProfile = profiles.find((p) => p.kycStatus === "KycVerified");
  if (!verifiedProfile) {
    res.status(403).json({ error: "KYC must be verified by a Distributor before subscribing" });
    return;
  }

  const operator = await getOperatorParty();
  const notes = await listNotes(operator);
  const note = notes.find((n) => n.contractId === req.params.contractId);
  if (!note) {
    res.status(404).json({ error: "investment note not found" });
    return;
  }

  if (parsed.data.amountNGN < note.minSubscriptionNGN) {
    res.status(400).json({ error: `amount is below this note's minimum subscription of ${note.minSubscriptionNGN}` });
    return;
  }

  const subscription = await createSubscriptionRequest({
    investor,
    distributor: verifiedProfile.distributor,
    issuingHouse: note.issuingHouse,
    sponsor: note.sponsor,
    noteCid: note.contractId,
    instrumentId: note.instrumentId,
    symbol: note.symbol,
    productName: note.productName,
    structureType: note.structureType,
    tenorMonths: note.tenorMonths,
    parValueNGN: note.parValueNGN,
    targetSizeNGN: note.targetSizeNGN,
    minSubscriptionNGN: note.minSubscriptionNGN,
    amountNGN: parsed.data.amountNGN,
  });
  res.status(201).json(subscription);
});

// SubscriptionRequest/Allocation's observer set (distributor, issuingHouse,
// sponsor) plus the investor's own signatory/observer status already scope
// this correctly per-party — no special-casing needed, unlike
// GET /investment-notes.
subscriptionsRouter.get("/subscriptions", requireRole("Investor", "Distributor", "IssuingHouse", "FundManager", "Issuer"), async (req, res) => {
  const subscriptions = await listSubscriptions(requireOrgParty(req));
  res.status(200).json(subscriptions);
});

// Preview only (docs/prompt.md's Risk Agent is advisory, not a gate —
// contrast with the Compliance Agent's real submit-to-sec block in
// api/regulatory.ts). Nothing is persisted until the Distributor actually
// allocates.
subscriptionsRouter.post("/subscriptions/:contractId/risk-check", requireRole("Distributor"), async (req, res) => {
  const distributor = requireOrgParty(req);
  const subscription = await findSubscriptionById(distributor, req.params.contractId);
  if (!subscription) {
    res.status(404).json({ error: "pending subscription not found" });
    return;
  }
  const alreadyAllocatedNGN = await sumAllocatedNGN(subscription.issuingHouse, subscription.instrumentId);
  const response = await invokeRiskAgent({
    structureType: subscription.structureType,
    tenorMonths: subscription.tenorMonths,
    targetSizeNGN: subscription.targetSizeNGN,
    minSubscriptionNGN: subscription.minSubscriptionNGN,
    requestedAmountNGN: subscription.amountNGN,
    alreadyAllocatedNGN,
  });
  res.status(200).json(response);
});

const allocateSchema = z.object({ allocatedAmountNGN: z.number().positive(), riskNotes: z.string().min(1) });

// Step 13. Unlike the Risk Agent's advisory output above, oversubscription
// is a real, server-enforced block — a fixed-size offering allocating more
// than its target size is a genuine regulatory problem, not a risk
// judgment call the Distributor should be free to override.
subscriptionsRouter.post("/subscriptions/:contractId/allocate", requireRole("Distributor"), async (req, res) => {
  const parsed = allocateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const distributor = requireOrgParty(req);
  const subscription = await findSubscriptionById(distributor, req.params.contractId);
  if (!subscription) {
    res.status(404).json({ error: "pending subscription not found" });
    return;
  }

  const alreadyAllocatedNGN = await sumAllocatedNGN(subscription.issuingHouse, subscription.instrumentId);
  if (alreadyAllocatedNGN + parsed.data.allocatedAmountNGN > subscription.targetSizeNGN) {
    res.status(409).json({
      error: "allocating this amount would exceed the offering's target size",
      alreadyAllocatedNGN,
      targetSizeNGN: subscription.targetSizeNGN,
    });
    return;
  }

  const allocation = await allocateSubscription({ distributor, contractId: req.params.contractId, ...parsed.data });
  res.status(201).json(allocation);
});

const rejectSchema = z.object({ rejectionReason: z.string().min(1) });

subscriptionsRouter.post("/subscriptions/:contractId/reject", requireRole("Distributor"), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await rejectSubscription({ distributor: requireOrgParty(req), contractId: req.params.contractId, ...parsed.data });
  res.status(204).end();
});

subscriptionsRouter.post("/subscriptions/:contractId/withdraw", requireRole("Investor"), async (req, res) => {
  await withdrawSubscription({ investor: requireOrgParty(req), contractId: req.params.contractId });
  res.status(204).end();
});
