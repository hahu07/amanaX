import { allocateParty, queryActiveContracts, submitCreate, submitExercise, templateId } from "./commands.js";

export const ORG_ROLES = [
  "FundManager",
  "IssuingHouse",
  "Trustee",
  "ShariahAdvisor",
  "Custodian",
  "Distributor",
  "SEC",
  "Issuer",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

const ORGANIZATION_TEMPLATE_ID = templateId("AmanaX.Identity.Organization", "Organization");
const USER_TEMPLATE_ID = templateId("AmanaX.Identity.User", "User");

export interface Organization {
  contractId: string;
  operator: string;
  party: string;
  name: string;
  role: OrgRole;
  active: boolean;
}

export interface OrgUser {
  contractId: string;
  operator: string;
  org: string;
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  active: boolean;
}

function toOrganization(contractId: string, arg: unknown): Organization {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    operator: a.operator as string,
    party: a.party as string,
    name: a.name as string,
    role: a.role as OrgRole,
    active: a.active as boolean,
  };
}

function toOrgUser(contractId: string, arg: unknown): OrgUser {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    operator: a.operator as string,
    org: a.org as string,
    userId: a.userId as string,
    email: a.email as string,
    displayName: a.displayName as string,
    role: a.role as OrgRole,
    active: a.active as boolean,
  };
}

export async function createOrganization(params: {
  operator: string;
  name: string;
  role: OrgRole;
}): Promise<Organization> {
  const party = await allocateParty(params.name.replace(/[^a-zA-Z0-9_-]/g, "-"));
  const { contractId, createArgument } = await submitCreate({
    templateId: ORGANIZATION_TEMPLATE_ID,
    actAs: [params.operator],
    createArguments: {
      operator: params.operator,
      party,
      name: params.name,
      role: params.role,
      active: true,
    },
  });
  return toOrganization(contractId, createArgument);
}

export async function listOrganizations(operator: string): Promise<Organization[]> {
  const contracts = await queryActiveContracts({ party: operator, templateFilterId: ORGANIZATION_TEMPLATE_ID });
  return contracts.map((c) => toOrganization(c.contractId, c.createArgument));
}

export async function setOrganizationActive(params: {
  operator: string;
  contractId: string;
  active: boolean;
}): Promise<Organization> {
  const { contractId, createArgument } = await submitExercise({
    templateId: ORGANIZATION_TEMPLATE_ID,
    contractId: params.contractId,
    choice: params.active ? "Organization_Reactivate" : "Organization_Deactivate",
    actAs: [params.operator],
  });
  return toOrganization(contractId, createArgument);
}

export async function createUser(params: {
  operator: string;
  org: string;
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
}): Promise<OrgUser> {
  const { contractId, createArgument } = await submitCreate({
    templateId: USER_TEMPLATE_ID,
    actAs: [params.operator],
    createArguments: {
      operator: params.operator,
      org: params.org,
      userId: params.userId,
      email: params.email,
      displayName: params.displayName,
      role: params.role,
      active: true,
    },
  });
  return toOrgUser(contractId, createArgument);
}

export async function listUsers(operator: string, org?: string): Promise<OrgUser[]> {
  const contracts = await queryActiveContracts({ party: operator, templateFilterId: USER_TEMPLATE_ID });
  const users = contracts.map((c) => toOrgUser(c.contractId, c.createArgument));
  return org ? users.filter((u) => u.org === org) : users;
}

export async function findUserByUserId(operator: string, userId: string): Promise<OrgUser | undefined> {
  const users = await listUsers(operator);
  return users.find((u) => u.userId === userId && u.active);
}

export async function findUserByEmail(operator: string, email: string): Promise<OrgUser | undefined> {
  const users = await listUsers(operator);
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.active);
}

export async function setUserActive(params: {
  operator: string;
  contractId: string;
  active: boolean;
}): Promise<OrgUser> {
  const { contractId, createArgument } = await submitExercise({
    templateId: USER_TEMPLATE_ID,
    contractId: params.contractId,
    choice: params.active ? "User_Reactivate" : "User_Deactivate",
    actAs: [params.operator],
  });
  return toOrgUser(contractId, createArgument);
}
