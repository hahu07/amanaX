import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { listNotes } from "../ledger/issuance.js";
import { listAllocationsForInstrument } from "../ledger/subscriptions.js";
import {
  approveDistributionRequest,
  createDistributionRequest,
  findDistributionRequestById,
  listDistributionRequests,
  listProfitDistributions,
  rejectDistributionRequest,
  withdrawDistributionRequest,
  type DistributionShare,
} from "../ledger/distributions.js";
import { readerParty } from "./issuance.js";

export const distributionsRouter = Router();

distributionsRouter.use(requireAuth);

// Pro-rates totalAmountNGN across every allocation by its unit count,
// rounded to 2dp for display (docs/implementation_plan.md §3.6) — the
// last share absorbs whatever rounding remainder is left so the shares
// always sum to exactly totalAmountNGN, not something a cent or two off.
function computeShares(totalAmountNGN: number, allocations: { investor: string; units: number }[]): DistributionShare[] {
  const totalUnits = allocations.reduce((sum, a) => sum + a.units, 0);
  const shares = allocations.map((a) => ({
    investor: a.investor,
    units: a.units,
    amountNGN: Math.round(((totalAmountNGN * a.units) / totalUnits) * 100) / 100,
  }));
  const distributed = shares.reduce((sum, s) => sum + s.amountNGN, 0);
  const remainder = Math.round((totalAmountNGN - distributed) * 100) / 100;
  if (remainder !== 0 && shares.length > 0) {
    shares[shares.length - 1].amountNGN = Math.round((shares[shares.length - 1].amountNGN + remainder) * 100) / 100;
  }
  return shares;
}

const proposeSchema = z.object({
  periodLabel: z.string().min(1),
  totalAmountNGN: z.number().positive(),
});

// Step 14 (docs/prompt.md): the Custodian calculates a distribution for
// an issued note. Deal facts (trustee, issuingHouse, sponsor, instrument
// identity) are re-derived from the on-ledger InvestmentNote; the pro-rata
// shares are computed here from the note's live Allocations, never
// trusted from the client.
distributionsRouter.post("/investment-notes/:contractId/distributions", requireRole("Custodian"), async (req, res) => {
  const parsed = proposeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const custodian = requireOrgParty(req);
  const notes = await listNotes(await readerParty(req));
  const note = notes.find((n) => n.contractId === req.params.contractId);
  if (!note) {
    res.status(404).json({ error: "investment note not found" });
    return;
  }

  const allocations = await listAllocationsForInstrument(note.issuingHouse, note.instrumentId);
  if (allocations.length === 0) {
    res.status(400).json({ error: "no investors have been allocated units of this note yet" });
    return;
  }

  const shares = computeShares(
    parsed.data.totalAmountNGN,
    allocations.map((a) => ({ investor: a.investor, units: a.units ?? 0 })),
  );

  const request = await createDistributionRequest({
    custodian,
    trustee: note.trustee,
    issuingHouse: note.issuingHouse,
    sponsor: note.sponsor,
    instrumentId: note.instrumentId,
    symbol: note.symbol,
    productName: note.productName,
    periodLabel: parsed.data.periodLabel,
    totalAmountNGN: parsed.data.totalAmountNGN,
    shares,
  });
  res.status(201).json(request);
});

distributionsRouter.get(
  "/distribution-requests",
  requireRole("Custodian", "Trustee", "IssuingHouse", "FundManager", "Issuer"),
  async (req, res) => {
    const requests = await listDistributionRequests(requireOrgParty(req));
    res.status(200).json(requests);
  },
);

distributionsRouter.post("/distribution-requests/:contractId/approve", requireRole("Trustee"), async (req, res) => {
  const trustee = requireOrgParty(req);
  const existing = await findDistributionRequestById(trustee, req.params.contractId);
  if (!existing) {
    res.status(404).json({ error: "distribution request not found" });
    return;
  }
  const distributions = await approveDistributionRequest({ trustee, contractId: req.params.contractId });
  res.status(201).json(distributions);
});

const rejectSchema = z.object({ rejectionReason: z.string().min(1) });

distributionsRouter.post("/distribution-requests/:contractId/reject", requireRole("Trustee"), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await rejectDistributionRequest({ trustee: requireOrgParty(req), contractId: req.params.contractId, ...parsed.data });
  res.status(204).end();
});

distributionsRouter.post("/distribution-requests/:contractId/withdraw", requireRole("Custodian"), async (req, res) => {
  await withdrawDistributionRequest({ custodian: requireOrgParty(req), contractId: req.params.contractId });
  res.status(204).end();
});

// ProfitDistribution's observer set (investor, issuingHouse, sponsor) plus
// custodian/trustee's own signatory status already scope this correctly
// per-party — an Investor's own query only ever returns their own
// records, never another investor's (see milestone-7.md Findings).
distributionsRouter.get(
  "/profit-distributions",
  requireRole("Custodian", "Trustee", "IssuingHouse", "FundManager", "Issuer", "Investor"),
  async (req, res) => {
    const distributions = await listProfitDistributions(requireOrgParty(req));
    res.status(200).json(distributions);
  },
);
