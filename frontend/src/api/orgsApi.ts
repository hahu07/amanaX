import { apiFetch } from "./backendClient";
import type { OrgRole } from "../auth/types";

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

export async function listOrgs(token: string): Promise<Organization[]> {
  return apiFetch<Organization[]>("/orgs", token);
}

export async function createOrg(token: string, params: { name: string; role: OrgRole }): Promise<Organization> {
  return apiFetch<Organization>("/orgs", token, { method: "POST", body: JSON.stringify(params) });
}

export async function setOrgActive(token: string, contractId: string, active: boolean): Promise<Organization> {
  return apiFetch<Organization>(`/orgs/${contractId}/active`, token, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function listUsers(token: string, org?: string): Promise<OrgUser[]> {
  const query = org ? `?org=${encodeURIComponent(org)}` : "";
  return apiFetch<OrgUser[]>(`/users${query}`, token);
}

export async function createUser(
  token: string,
  params: { org: string; userId: string; email: string; displayName: string; role: OrgRole },
): Promise<OrgUser> {
  return apiFetch<OrgUser>("/users", token, { method: "POST", body: JSON.stringify(params) });
}
