import { Router } from "express";
import { z } from "zod";
import { getOperatorParty } from "../ledger/operator.js";
import { listOrganizations } from "../ledger/organizations.js";
import { createInvestorProfile } from "../ledger/investors.js";

// Step 11 (docs/prompt.md): "Investors complete onboarding" — the one
// self-service identity flow in this system (every other role is onboarded
// by the Platform Operator). Deliberately public: no bearer token exists
// yet for a brand-new investor, and this backend's whole auth posture is
// already the dev/no-password login documented in api/auth.ts — adding a
// public write here doesn't introduce a new security gap beyond that
// already-accepted one, and hardening both is explicitly deferred to
// Milestone 9 (docs/implementation_plan.md Milestone 9: "Security pass").
export const investorSignupRouter = Router();

investorSignupRouter.get("/distributors", async (_req, res) => {
  const operator = await getOperatorParty();
  const orgs = await listOrganizations(operator);
  const distributors = orgs.filter((o) => o.role === "Distributor" && o.active).map((o) => ({ party: o.party, name: o.name }));
  res.status(200).json(distributors);
});

const signupSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  distributor: z.string().min(1),
});

investorSignupRouter.post("/investor-signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const operator = await getOperatorParty();
  const profile = await createInvestorProfile({ operator, ...parsed.data });
  res.status(201).json(profile);
});
