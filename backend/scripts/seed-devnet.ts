// One-time seed for the DevNet participant (hackcanton-01): this backend's
// ledger-api user has no rights to allocate parties itself there (see
// config.ts's OPERATOR_PARTY doc comment), so the participant operator
// allocated 10 fixed parties for us out-of-band and granted CanActAs rights
// on all of them. This script creates the same Organization/User/
// InvestorProfile contracts the Operator dashboard would create dynamically
// on local sandbox, but against those fixed parties instead of calling
// allocateParty — mirrors the local walkthrough's org/user set exactly so
// login emails carry over.
//
// Requires OPERATOR_PARTY and LEDGER_API_TOKEN set in backend/.env, and
// LEDGER_API_URL pointed at the DevNet participant. Run with:
//   npx tsx scripts/seed-devnet.ts
import "dotenv/config";
import { getOperatorParty } from "../src/ledger/operator.js";
import { createOrganization, createUser, type OrgRole } from "../src/ledger/organizations.js";
import { createInvestorProfile } from "../src/ledger/investors.js";

const DEVNET_NAMESPACE = "122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const party = (hint: string) => `${hint}::${DEVNET_NAMESPACE}`;

interface OrgSeed {
  hint: string;
  name: string;
  role: OrgRole;
  email: string;
  displayName: string;
}

const ORG_SEEDS: OrgSeed[] = [
  { hint: "AmanaFundManager", name: "Amana Fund Managers Ltd", role: "FundManager", email: "fm@amana.ng", displayName: "Amina Bello" },
  { hint: "AmanaIssuingHouse", name: "Amana Finance Ltd", role: "IssuingHouse", email: "ade@amanafin.ng", displayName: "Ayman Ridwanllah" },
  { hint: "AmanaTrustee", name: "Amana Trustee Services", role: "Trustee", email: "trustee@amanatrustee.ng", displayName: "Barrister Musa Danjuma" },
  { hint: "AmanaShariahAdvisor", name: "Amana Shariah Board", role: "ShariahAdvisor", email: "advisor@amanashariah.ng", displayName: "Sheikh Amina Bello" },
  { hint: "AmanaCustodian", name: "Amana Custody Bank", role: "Custodian", email: "custodian@amanacustody.ng", displayName: "Fatima Abubakar" },
  { hint: "AmanaDistributor", name: "Amana Distribution Partners", role: "Distributor", email: "distributor@amanadist.ng", displayName: "Ibrahim Suleiman" },
  { hint: "AmanaSEC", name: "Nigeria SEC", role: "SEC", email: "reviewer@sec.gov.ng", displayName: "Chidi Okafor" },
  { hint: "AmanaIssuer", name: "Amana Trading Ltd", role: "Issuer", email: "rid@amana.ng", displayName: "Tijjani Ridwanlah" },
];

async function main() {
  const operator = await getOperatorParty();
  console.log(`Operator party: ${operator}`);

  const orgParties: Record<string, string> = {};

  for (const seed of ORG_SEEDS) {
    const org = await createOrganization({ operator, name: seed.name, role: seed.role, party: party(seed.hint) });
    orgParties[seed.role] = org.party;
    console.log(`Created org: ${seed.name} (${seed.role}) -> ${org.party}`);

    const user = await createUser({
      operator,
      org: org.party,
      userId: `${seed.hint}-user`,
      email: seed.email,
      displayName: seed.displayName,
      role: seed.role,
    });
    console.log(`  Created user: ${user.email} -> ${user.displayName}`);
  }

  const investorProfile = await createInvestorProfile({
    operator,
    distributor: orgParties["Distributor"],
    fullName: "Yusuf Garba",
    email: "yusuf.garba@investor.ng",
    party: party("AmanaInvestor1"),
  });
  console.log(`Created investor profile: ${investorProfile.email} -> ${investorProfile.investor}`);

  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
