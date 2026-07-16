import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded AND the agents service on :4100, same as test/subscriptions.test.ts.

let operatorToken: string;
let fundManagerToken: string;
let issuingHouseToken: string;
let issuingHouseParty: string;
let shariahAdvisorToken: string;
let shariahAdvisorParty: string;
let trusteeToken: string;
let trusteeParty: string;
let secToken: string;
let secParty: string;
let distributorToken: string;
let distributorParty: string;
let custodianToken: string;

async function onboardOrgAndLogin(
  role: "FundManager" | "IssuingHouse" | "ShariahAdvisor" | "Trustee" | "SEC" | "Distributor" | "Custodian",
  label: string,
) {
  const orgRes = await request(app)
    .post("/orgs")
    .set("Authorization", `Bearer ${operatorToken}`)
    .send({ name: `${label} ${Date.now()}`, role });
  expect(orgRes.status).toBe(201);

  const email = `${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}@example.com`;
  await request(app)
    .post("/users")
    .set("Authorization", `Bearer ${operatorToken}`)
    .send({ org: orgRes.body.party, userId: email, email, displayName: label, role });

  const loginRes = await request(app).post("/auth/login").send({ email });
  expect(loginRes.status).toBe(200);
  return { token: loginRes.body.token as string, party: orgRes.body.party as string };
}

async function signupAndLoginInvestor(label: string): Promise<{ token: string; party: string; email: string }> {
  const email = `${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}@example.com`;
  const signupRes = await request(app).post("/investor-signup").send({ fullName: label, email, distributor: distributorParty });
  expect(signupRes.status).toBe(201);

  const loginRes = await request(app).post("/auth/login").send({ email });
  expect(loginRes.status).toBe(200);
  return { token: loginRes.body.token as string, party: signupRes.body.investor as string, email };
}

async function issueNote(overrides?: { productName?: string; targetSizeNGN?: number; parValueNGN?: number }): Promise<string> {
  const proposeRes = await request(app)
    .post("/proposals")
    .set("Authorization", `Bearer ${fundManagerToken}`)
    .send({
      issuingHouse: issuingHouseParty,
      productName: overrides?.productName ?? "AmanaX Distribution Note",
      description: "A Shariah-compliant Ijarah-backed investment note.",
      proposedType: "Ijarah",
      targetSizeNGN: overrides?.targetSizeNGN ?? 100000000,
      tenorMonths: 24,
    });
  expect(proposeRes.status).toBe(201);

  const structureRes = await request(app)
    .post(`/proposals/${proposeRes.body.contractId}/structure`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({
      structureType: "Ijarah",
      profitMechanism: "Lease rental distributed quarterly",
      minSubscriptionNGN: 1000000,
      redemptionTerms: "Bullet redemption at maturity",
      structureTenorMonths: 24,
    });
  expect(structureRes.status).toBe(201);

  const finalizeRes = await request(app)
    .post(`/structures/${structureRes.body.contractId}/finalize`)
    .set("Authorization", `Bearer ${issuingHouseToken}`);

  const submitShariahRes = await request(app)
    .post(`/structures/${finalizeRes.body.contractId}/submit-shariah-review`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ shariahAdvisor: shariahAdvisorParty });

  const certifyRes = await request(app)
    .post(`/shariah-reviews/${submitShariahRes.body.contractId}/certify`)
    .set("Authorization", `Bearer ${shariahAdvisorToken}`)
    .send({ certificationNotes: "Structure conforms to Ijarah principles; no interest-bearing elements found." });

  const submitTrusteeRes = await request(app)
    .post(`/shariah-reviews/${certifyRes.body.contractId}/submit-trustee-review`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ trustee: trusteeParty });

  const approveTrusteeRes = await request(app)
    .post(`/trustee-reviews/${submitTrusteeRes.body.contractId}/approve`)
    .set("Authorization", `Bearer ${trusteeToken}`)
    .send({ approvalNotes: "Governance and investor-protection terms are adequate for this issuance." });

  const submitSecRes = await request(app)
    .post(`/trustee-reviews/${approveTrusteeRes.body.contractId}/submit-to-sec`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ sec: secParty });

  const approveSecRes = await request(app)
    .post(`/regulatory-submissions/${submitSecRes.body.contractId}/approve`)
    .set("Authorization", `Bearer ${secToken}`)
    .send({ approvalReference: `SEC/AMX/${Date.now()}` });

  const issueRes = await request(app)
    .post(`/sec-approvals/${approveSecRes.body.contractId}/issue`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ symbol: `AMX${Date.now()}`, parValueNGN: overrides?.parValueNGN ?? 1000000 });
  expect(issueRes.status).toBe(201);
  return issueRes.body.contractId as string;
}

async function subscribeAndAllocate(noteId: string, investorToken: string, amountNGN: number): Promise<void> {
  const subscribeRes = await request(app)
    .post(`/investment-notes/${noteId}/subscribe`)
    .set("Authorization", `Bearer ${investorToken}`)
    .send({ amountNGN });
  expect(subscribeRes.status).toBe(201);
  const allocateRes = await request(app)
    .post(`/subscriptions/${subscribeRes.body.contractId}/allocate`)
    .set("Authorization", `Bearer ${distributorToken}`)
    .send({ allocatedAmountNGN: amountNGN, riskNotes: "OK." });
  expect(allocateRes.status).toBe(201);
}

async function verifyKyc(investorToken: string): Promise<void> {
  const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investorToken}`);
  await request(app).post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`).set("Authorization", `Bearer ${distributorToken}`);
}

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;

  const fm = await onboardOrgAndLogin("FundManager", "Distribution Test FM");
  fundManagerToken = fm.token;

  const ih = await onboardOrgAndLogin("IssuingHouse", "Distribution Test IH");
  issuingHouseToken = ih.token;
  issuingHouseParty = ih.party;

  const sa = await onboardOrgAndLogin("ShariahAdvisor", "Distribution Test SA");
  shariahAdvisorToken = sa.token;
  shariahAdvisorParty = sa.party;

  const tr = await onboardOrgAndLogin("Trustee", "Distribution Test Trustee");
  trusteeToken = tr.token;
  trusteeParty = tr.party;

  const sec = await onboardOrgAndLogin("SEC", "Distribution Test SEC");
  secToken = sec.token;
  secParty = sec.party;

  const dist = await onboardOrgAndLogin("Distributor", "Distribution Test Dist");
  distributorToken = dist.token;
  distributorParty = dist.party;

  const cust = await onboardOrgAndLogin("Custodian", "Distribution Test Custodian");
  custodianToken = cust.token;
});

describe("Profit distribution", () => {
  it("computes exact pro-rata shares, approves, and keeps each investor's statement private", async () => {
    const noteId = await issueNote();
    const investorA = await signupAndLoginInvestor("Investor A Dist");
    const investorB = await signupAndLoginInvestor("Investor B Dist");
    await verifyKyc(investorA.token);
    await verifyKyc(investorB.token);
    await subscribeAndAllocate(noteId, investorA.token, 10000000); // 10 units
    await subscribeAndAllocate(noteId, investorB.token, 5000000); // 5 units

    const proposeRes = await request(app)
      .post(`/investment-notes/${noteId}/distributions`)
      .set("Authorization", `Bearer ${custodianToken}`)
      .send({ periodLabel: "Q1 2026", totalAmountNGN: 1500000 });
    expect(proposeRes.status).toBe(201);
    expect(proposeRes.body.shares).toHaveLength(2);
    const shareSum = proposeRes.body.shares.reduce((s: number, x: { amountNGN: number }) => s + x.amountNGN, 0);
    expect(shareSum).toBe(1500000);
    const shareA = proposeRes.body.shares.find((s: { investor: string }) => s.investor === investorA.party);
    expect(shareA.amountNGN).toBe(1000000);

    const approveRes = await request(app)
      .post(`/distribution-requests/${proposeRes.body.contractId}/approve`)
      .set("Authorization", `Bearer ${trusteeToken}`);
    expect(approveRes.status).toBe(201);
    expect(approveRes.body).toHaveLength(2);

    const aStatementRes = await request(app).get("/profit-distributions").set("Authorization", `Bearer ${investorA.token}`);
    expect(aStatementRes.status).toBe(200);
    expect(aStatementRes.body).toHaveLength(1);
    expect(aStatementRes.body[0].amountNGN).toBe(1000000);

    const bStatementRes = await request(app).get("/profit-distributions").set("Authorization", `Bearer ${investorB.token}`);
    expect(bStatementRes.body).toHaveLength(1);
    expect(bStatementRes.body[0].amountNGN).toBe(500000);

    // Privacy: investor A's statement never includes investor B's contractId, or vice versa.
    expect(aStatementRes.body[0].contractId).not.toBe(bStatementRes.body[0].contractId);

    const custodianHistoryRes = await request(app).get("/profit-distributions").set("Authorization", `Bearer ${custodianToken}`);
    expect(custodianHistoryRes.body).toHaveLength(2);
  });

  it("rejects a non-Custodian trying to propose a distribution (backend RBAC)", async () => {
    const noteId = await issueNote();
    const res = await request(app)
      .post(`/investment-notes/${noteId}/distributions`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ periodLabel: "Q1 2026", totalAmountNGN: 100000 });
    expect(res.status).toBe(403);
  });

  it("blocks proposing a distribution when nobody has been allocated units yet", async () => {
    const noteId = await issueNote();
    const res = await request(app)
      .post(`/investment-notes/${noteId}/distributions`)
      .set("Authorization", `Bearer ${custodianToken}`)
      .send({ periodLabel: "Q1 2026", totalAmountNGN: 100000 });
    expect(res.status).toBe(400);
  });

  it("lets the Custodian withdraw and the Trustee reject a distribution request", async () => {
    const noteId = await issueNote();
    const investor = await signupAndLoginInvestor("Investor C Dist");
    await verifyKyc(investor.token);
    await subscribeAndAllocate(noteId, investor.token, 2000000);

    const withdrawTarget = await request(app)
      .post(`/investment-notes/${noteId}/distributions`)
      .set("Authorization", `Bearer ${custodianToken}`)
      .send({ periodLabel: "Q1 2026", totalAmountNGN: 50000 });
    const withdrawRes = await request(app)
      .post(`/distribution-requests/${withdrawTarget.body.contractId}/withdraw`)
      .set("Authorization", `Bearer ${custodianToken}`);
    expect(withdrawRes.status).toBe(204);

    const rejectTarget = await request(app)
      .post(`/investment-notes/${noteId}/distributions`)
      .set("Authorization", `Bearer ${custodianToken}`)
      .send({ periodLabel: "Q1 2026", totalAmountNGN: 50000 });
    const rejectRes = await request(app)
      .post(`/distribution-requests/${rejectTarget.body.contractId}/reject`)
      .set("Authorization", `Bearer ${trusteeToken}`)
      .send({ rejectionReason: "Underlying asset performance not yet confirmed." });
    expect(rejectRes.status).toBe(204);
  });
});
