import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { PRODUCT_TYPES, finalizeStructure, listStructures, updateStructureTerms } from "../ledger/products.js";

export const structuresRouter = Router();

structuresRouter.use(requireAuth);

structuresRouter.get("/structures", requireRole("FundManager", "IssuingHouse"), async (req, res) => {
  const structures = await listStructures(requireOrgParty(req));
  res.status(200).json(structures);
});

const updateTermsSchema = z.object({
  newStructureType: z.enum(PRODUCT_TYPES),
  newProfitMechanism: z.string().min(1),
  newMinSubscriptionNGN: z.number().nonnegative(),
  newRedemptionTerms: z.string().min(1),
  newTenorMonths: z.number().int().positive(),
});

structuresRouter.patch("/structures/:contractId", requireRole("IssuingHouse"), async (req, res) => {
  const parsed = updateTermsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const structure = await updateStructureTerms({
    issuingHouse: requireOrgParty(req),
    contractId: req.params.contractId,
    ...parsed.data,
  });
  res.status(200).json(structure);
});

structuresRouter.post("/structures/:contractId/finalize", requireRole("IssuingHouse"), async (req, res) => {
  const structure = await finalizeStructure({ issuingHouse: requireOrgParty(req), contractId: req.params.contractId });
  res.status(200).json(structure);
});
