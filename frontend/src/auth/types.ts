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

// Human-readable label for a backend role — used across the UI (top bar,
// sidebar, page headers) instead of the raw PascalCase role identifier.
export const ROLE_LABEL: Record<Role, string> = {
  PlatformOperator: "Platform Operator",
  FundManager: "Fund Manager",
  IssuingHouse: "Issuing House",
  Trustee: "Trustee",
  ShariahAdvisor: "Shariah Advisor",
  Custodian: "Custodian",
  Distributor: "Distributor",
  SEC: "SEC",
};
