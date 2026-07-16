import { allocateParty, queryActiveContracts, submitCreate, submitExercise, templateId } from "./commands.js";

export const KYC_STATUSES = ["KycPending", "KycVerified", "KycRejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

const INVESTOR_PROFILE_TEMPLATE_ID = templateId("AmanaX.Investor.InvestorProfile", "InvestorProfile");

export interface InvestorProfile {
  contractId: string;
  operator: string;
  investor: string;
  distributor: string;
  fullName: string;
  email: string;
  kycStatus: KycStatus;
}

function toInvestorProfile(contractId: string, arg: unknown): InvestorProfile {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    operator: a.operator as string,
    investor: a.investor as string,
    distributor: a.distributor as string,
    fullName: a.fullName as string,
    email: a.email as string,
    kycStatus: a.kycStatus as KycStatus,
  };
}

// Step 11 (docs/prompt.md): an Investor self-registers (see
// api/investorSignup.ts's public route), but the party allocation and
// ledger write are still backend-driven with the Operator's authority —
// same "platform-managed party" reasoning as every other identity record,
// just triggered by a public endpoint instead of a Platform-Operator-only
// one.
export async function createInvestorProfile(params: {
  operator: string;
  distributor: string;
  fullName: string;
  email: string;
}): Promise<InvestorProfile> {
  const investor = await allocateParty(params.fullName.replace(/[^a-zA-Z0-9_-]/g, "-"));
  const { contractId, createArgument } = await submitCreate({
    templateId: INVESTOR_PROFILE_TEMPLATE_ID,
    actAs: [params.operator],
    createArguments: {
      operator: params.operator,
      investor,
      distributor: params.distributor,
      fullName: params.fullName,
      email: params.email,
      kycStatus: "KycPending",
    },
  });
  return toInvestorProfile(contractId, createArgument);
}

export async function listInvestorProfiles(party: string): Promise<InvestorProfile[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: INVESTOR_PROFILE_TEMPLATE_ID });
  return contracts.map((c) => toInvestorProfile(c.contractId, c.createArgument));
}

export async function findInvestorProfileByEmail(operator: string, email: string): Promise<InvestorProfile | undefined> {
  const profiles = await listInvestorProfiles(operator);
  return profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
}

export async function findInvestorProfileById(party: string, contractId: string): Promise<InvestorProfile | undefined> {
  const profiles = await listInvestorProfiles(party);
  return profiles.find((p) => p.contractId === contractId);
}

export async function verifyInvestorProfile(params: { distributor: string; contractId: string }): Promise<InvestorProfile> {
  const { contractId, createArgument } = await submitExercise({
    templateId: INVESTOR_PROFILE_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "InvestorProfile_Verify",
    actAs: [params.distributor],
  });
  return toInvestorProfile(contractId, createArgument);
}

export async function rejectInvestorProfile(params: {
  distributor: string;
  contractId: string;
  rejectionReason: string;
}): Promise<InvestorProfile> {
  const { contractId, createArgument } = await submitExercise({
    templateId: INVESTOR_PROFILE_TEMPLATE_ID,
    contractId: params.contractId,
    choice: "InvestorProfile_Reject",
    actAs: [params.distributor],
    choiceArgument: { rejectionReason: params.rejectionReason },
  });
  return toInvestorProfile(contractId, createArgument);
}
