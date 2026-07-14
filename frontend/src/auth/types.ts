export const ORG_ROLES = [
  "FundManager",
  "IssuingHouse",
  "Trustee",
  "ShariahAdvisor",
  "Custodian",
  "Distributor",
  "SEC",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export type Role = "PlatformOperator" | OrgRole;

export interface AuthState {
  token: string;
  role: Role;
  org: string | null;
  party: string | null;
}

// Maps a backend role to its dashboard route segment.
export const ROLE_ROUTE: Record<Role, string> = {
  PlatformOperator: "operator",
  FundManager: "fund-manager",
  IssuingHouse: "issuing-house",
  Trustee: "trustee",
  ShariahAdvisor: "shariah-advisor",
  Custodian: "custodian",
  Distributor: "distributor",
  SEC: "sec",
};
