import type { OrgRole } from "../ledger/organizations.js";

export type Role = "PlatformOperator" | OrgRole;

// What the backend's RBAC layer maps a JWT-authenticated request to: an org
// party (null for the Platform Operator, who isn't an Organization) and a
// role. Ledger commands are submitted with this party as actAs — see
// docs/implementation_plan.md §3.3.
export interface AuthClaims {
  sub: string;
  org: string | null;
  role: Role;
  displayName: string;
}
