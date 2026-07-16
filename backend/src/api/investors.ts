import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { getOperatorParty } from "../ledger/operator.js";
import { findInvestorProfileById, listInvestorProfiles, rejectInvestorProfile, verifyInvestorProfile } from "../ledger/investors.js";

export const investorsRouter = Router();

investorsRouter.use(requireAuth);

// InvestorProfile's signatory/observer set is operator, investor,
// distributor — each of the three roles below queries via its own party
// and Daml's own stakeholder visibility does the filtering (an Investor
// only ever sees their own profile; a Distributor only sees the ones
// assigned to it; the Operator sees all of them).
investorsRouter.get("/investor-profiles", requireRole("Distributor", "PlatformOperator", "Investor"), async (req, res) => {
  const party = req.auth!.role === "PlatformOperator" ? await getOperatorParty() : requireOrgParty(req);
  const profiles = await listInvestorProfiles(party);
  res.status(200).json(profiles);
});

investorsRouter.post("/investor-profiles/:contractId/verify", requireRole("Distributor"), async (req, res) => {
  const distributor = requireOrgParty(req);
  const existing = await findInvestorProfileById(distributor, req.params.contractId);
  if (!existing) {
    res.status(404).json({ error: "investor profile not found" });
    return;
  }
  const profile = await verifyInvestorProfile({ distributor, contractId: req.params.contractId });
  res.status(200).json(profile);
});

const rejectSchema = z.object({ rejectionReason: z.string().min(1) });

investorsRouter.post("/investor-profiles/:contractId/reject", requireRole("Distributor"), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const distributor = requireOrgParty(req);
  const existing = await findInvestorProfileById(distributor, req.params.contractId);
  if (!existing) {
    res.status(404).json({ error: "investor profile not found" });
    return;
  }
  const profile = await rejectInvestorProfile({ distributor, contractId: req.params.contractId, ...parsed.data });
  res.status(200).json(profile);
});
