import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { getOperatorParty } from "../ledger/operator.js";
import {
  ORG_ROLES,
  createOrganization,
  createUser,
  listOrganizations,
  listUsers,
  setOrganizationActive,
} from "../ledger/organizations.js";

export const orgsRouter = Router();

orgsRouter.use(requireAuth);

const createOrgSchema = z.object({
  name: z.string().min(1),
  role: z.enum(ORG_ROLES),
});

orgsRouter.post("/orgs", requireRole("PlatformOperator"), async (req, res) => {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const operator = await getOperatorParty();
  const org = await createOrganization({ operator, ...parsed.data });
  res.status(201).json(org);
});

orgsRouter.get("/orgs", requireRole("PlatformOperator"), async (_req, res) => {
  const operator = await getOperatorParty();
  const orgs = await listOrganizations(operator);
  res.status(200).json(orgs);
});

orgsRouter.patch("/orgs/:contractId/active", requireRole("PlatformOperator"), async (req, res) => {
  const active = z.boolean().safeParse(req.body?.active);
  if (!active.success) {
    res.status(400).json({ error: "body must be { active: boolean }" });
    return;
  }
  const operator = await getOperatorParty();
  const org = await setOrganizationActive({ operator, contractId: req.params.contractId, active: active.data });
  res.status(200).json(org);
});

const createUserSchema = z.object({
  org: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(ORG_ROLES),
});

orgsRouter.post("/users", requireRole("PlatformOperator"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const operator = await getOperatorParty();
  const user = await createUser({ operator, ...parsed.data });
  res.status(201).json(user);
});

orgsRouter.get("/users", requireRole("PlatformOperator"), async (req, res) => {
  const operator = await getOperatorParty();
  const org = typeof req.query.org === "string" ? req.query.org : undefined;
  const users = await listUsers(operator, org);
  res.status(200).json(users);
});
