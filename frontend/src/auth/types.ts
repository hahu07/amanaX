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

// Investor is deliberately not an OrgRole — see backend/src/auth/types.ts's
// module comment: an Investor is an individual with its own
// platform-managed party, not a firm sharing one party across Users.
export type Role = "PlatformOperator" | OrgRole | "Investor";

export interface AuthState {
  token: string;
  role: Role;
  org: string | null;
  party: string | null;
}

// Maps a backend role to its dashboard route segment. FundManager and
// Issuer are both product "sponsors" (see productsApi.ts) and share the
// same dashboard component (dashboards/productSponsor) — distinct roles,
// same UI, since the workflow is identical and only the regulatory
// pathway differs.
export const ROLE_ROUTE: Record<Role, string> = {
  PlatformOperator: "operator",
  FundManager: "fund-manager",
  IssuingHouse: "issuing-house",
  Trustee: "trustee",
  ShariahAdvisor: "shariah-advisor",
  Custodian: "custodian",
  Distributor: "distributor",
  SEC: "sec",
  Issuer: "issuer",
  Investor: "investor",
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
  Issuer: "Issuer",
  Investor: "Investor",
};
