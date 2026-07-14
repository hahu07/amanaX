import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { findUserByEmail } from "../ledger/organizations.js";
import { getOperatorParty } from "../ledger/operator.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email() });

// Dev-login: no password. This is a deliberate placeholder — see
// docs/implementation_plan.md §2 ("Auth in production is JWT via an OIDC
// provider") — swapping this route for real OIDC (Keycloak/Auth0) is future
// work, not scoped to Milestone 1. It's still a real JWT the rest of the
// backend trusts identically either way, which is what makes the swap
// non-invasive later.
authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email } = parsed.data;

  if (email.toLowerCase() === config.operatorEmail.toLowerCase()) {
    const operator = await getOperatorParty();
    const token = signToken({ sub: "operator", org: null, role: "PlatformOperator", displayName: "Platform Operator" });
    res.status(200).json({ token, role: "PlatformOperator", org: null, party: operator });
    return;
  }

  const operator = await getOperatorParty();
  const user = await findUserByEmail(operator, email);
  if (!user) {
    res.status(401).json({ error: "no active user found for this email" });
    return;
  }
  const token = signToken({ sub: user.userId, org: user.org, role: user.role, displayName: user.displayName });
  res.status(200).json({ token, role: user.role, org: user.org, party: user.org });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.status(200).json(req.auth);
});
