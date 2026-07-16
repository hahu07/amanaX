import { apiFetch } from "./backendClient";

export type KycStatus = "KycPending" | "KycVerified" | "KycRejected";

export interface InvestorProfile {
  contractId: string;
  operator: string;
  investor: string;
  distributor: string;
  fullName: string;
  email: string;
  kycStatus: KycStatus;
}

export interface DistributorOption {
  party: string;
  name: string;
}

// Public — no token, called from the pre-login signup page.
export async function listPublicDistributors(): Promise<DistributorOption[]> {
  return apiFetch<DistributorOption[]>("/distributors", null);
}

export async function signupInvestor(params: { fullName: string; email: string; distributor: string }): Promise<InvestorProfile> {
  return apiFetch<InvestorProfile>("/investor-signup", null, { method: "POST", body: JSON.stringify(params) });
}

export async function listInvestorProfiles(token: string): Promise<InvestorProfile[]> {
  return apiFetch<InvestorProfile[]>("/investor-profiles", token);
}

export async function verifyInvestorProfile(token: string, contractId: string): Promise<InvestorProfile> {
  return apiFetch<InvestorProfile>(`/investor-profiles/${contractId}/verify`, token, { method: "POST" });
}

export async function rejectInvestorProfile(token: string, contractId: string, rejectionReason: string): Promise<InvestorProfile> {
  return apiFetch<InvestorProfile>(`/investor-profiles/${contractId}/reject`, token, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  });
}
