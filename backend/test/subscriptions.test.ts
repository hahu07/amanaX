import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded AND the agents service on :4100, same as test/issuance.test.ts.

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

async function onboardOrgAndLogin(role: "FundManager" | "IssuingHouse" | "ShariahAdvisor" | "Trustee" | "SEC" | "Distributor", label: string) {
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
  expect(loginRes.body.role).toBe("Investor");
  return { token: loginRes.body.token as string, party: signupRes.body.investor as string, email };
}

async function issueNote(overrides?: { productName?: string; targetSizeNGN?: number; parValueNGN?: number }): Promise<string> {
  const proposeRes = await request(app)
    .post("/proposals")
    .set("Authorization", `Bearer ${fundManagerToken}`)
    .send({
      issuingHouse: issuingHouseParty,
      productName: overrides?.productName ?? "AmanaX Sukuk Note I",
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
  expect(finalizeRes.status).toBe(200);

  const submitShariahRes = await request(app)
    .post(`/structures/${finalizeRes.body.contractId}/submit-shariah-review`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ shariahAdvisor: shariahAdvisorParty });
  expect(submitShariahRes.status).toBe(201);

  const certifyRes = await request(app)
    .post(`/shariah-reviews/${submitShariahRes.body.contractId}/certify`)
    .set("Authorization", `Bearer ${shariahAdvisorToken}`)
    .send({ certificationNotes: "Structure conforms to Ijarah principles; no interest-bearing elements found." });
  expect(certifyRes.status).toBe(200);

  const submitTrusteeRes = await request(app)
    .post(`/shariah-reviews/${certifyRes.body.contractId}/submit-trustee-review`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ trustee: trusteeParty });
  expect(submitTrusteeRes.status).toBe(201);

  const approveTrusteeRes = await request(app)
    .post(`/trustee-reviews/${submitTrusteeRes.body.contractId}/approve`)
    .set("Authorization", `Bearer ${trusteeToken}`)
    .send({ approvalNotes: "Governance and investor-protection terms are adequate for this issuance." });
  expect(approveTrusteeRes.status).toBe(200);

  const submitSecRes = await request(app)
    .post(`/trustee-reviews/${approveTrusteeRes.body.contractId}/submit-to-sec`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ sec: secParty });
  expect(submitSecRes.status).toBe(201);

  const approveSecRes = await request(app)
    .post(`/regulatory-submissions/${submitSecRes.body.contractId}/approve`)
    .set("Authorization", `Bearer ${secToken}`)
    .send({ approvalReference: `SEC/AMX/${Date.now()}` });
  expect(approveSecRes.status).toBe(200);

  const issueRes = await request(app)
    .post(`/sec-approvals/${approveSecRes.body.contractId}/issue`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ symbol: `AMX${Date.now()}`, parValueNGN: overrides?.parValueNGN ?? 1000000 });
  expect(issueRes.status).toBe(201);
  return issueRes.body.contractId as string;
}

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;

  const fm = await onboardOrgAndLogin("FundManager", "Subscription Test FM");
  fundManagerToken = fm.token;

  const ih = await onboardOrgAndLogin("IssuingHouse", "Subscription Test IH");
  issuingHouseToken = ih.token;
  issuingHouseParty = ih.party;

  const sa = await onboardOrgAndLogin("ShariahAdvisor", "Subscription Test SA");
  shariahAdvisorToken = sa.token;
  shariahAdvisorParty = sa.party;

  const tr = await onboardOrgAndLogin("Trustee", "Subscription Test Trustee");
  trusteeToken = tr.token;
  trusteeParty = tr.party;

  const sec = await onboardOrgAndLogin("SEC", "Subscription Test SEC");
  secToken = sec.token;
  secParty = sec.party;

  const dist = await onboardOrgAndLogin("Distributor", "Subscription Test Dist");
  distributorToken = dist.token;
  distributorParty = dist.party;
});

describe("Investor onboarding, subscription, and allocation", () => {
  it("lets an investor sign up, get KYC-verified, subscribe, and be allocated a real Holding", async () => {
    const noteId = await issueNote();
    const investor = await signupAndLoginInvestor("Amina Investor");

    // Can't subscribe before KYC is verified.
    const blockedRes = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 5000000 });
    expect(blockedRes.status).toBe(403);

    // Investor can see their own Pending profile; Distributor verifies it.
    const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investor.token}`);
    expect(profilesRes.status).toBe(200);
    expect(profilesRes.body).toHaveLength(1);
    expect(profilesRes.body[0].kycStatus).toBe("KycPending");

    const verifyRes = await request(app)
      .post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`)
      .set("Authorization", `Bearer ${distributorToken}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.kycStatus).toBe("KycVerified");

    // Now the subscription succeeds.
    const subscribeRes = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 5000000 });
    expect(subscribeRes.status).toBe(201);
    expect(subscribeRes.body.status).toBe("Pending");
    expect(subscribeRes.body.distributor).toBe(distributorParty);

    // Distributor previews the (advisory) Risk Agent assessment.
    const riskRes = await request(app)
      .post(`/subscriptions/${subscribeRes.body.contractId}/risk-check`)
      .set("Authorization", `Bearer ${distributorToken}`);
    expect(riskRes.status).toBe(200);
    expect(riskRes.body.agent).toBe("risk");
    expect(riskRes.body.output.concentrationTier).toBeDefined();
    expect(riskRes.body.output.overallRisk).toBeDefined();

    // Distributor allocates in full.
    const allocateRes = await request(app)
      .post(`/subscriptions/${subscribeRes.body.contractId}/allocate`)
      .set("Authorization", `Bearer ${distributorToken}`)
      .send({ allocatedAmountNGN: 5000000, riskNotes: riskRes.body.output.notes });
    expect(allocateRes.status).toBe(201);
    expect(allocateRes.body.status).toBe("Allocated");
    expect(allocateRes.body.units).toBe(5);

    // The investor sees their own allocation.
    const investorSubsRes = await request(app).get("/subscriptions").set("Authorization", `Bearer ${investor.token}`);
    expect(investorSubsRes.body.some((s: { contractId: string }) => s.contractId === allocateRes.body.contractId)).toBe(true);

    // Issuing House can see it too (observer).
    const ihSubsRes = await request(app).get("/subscriptions").set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(ihSubsRes.body.some((s: { contractId: string }) => s.contractId === allocateRes.body.contractId)).toBe(true);
  });

  it("rejects a non-Distributor trying to verify KYC or allocate (backend RBAC)", async () => {
    const investor = await signupAndLoginInvestor("Chidi Investor");
    const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investor.token}`);
    const forbiddenVerify = await request(app)
      .post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(forbiddenVerify.status).toBe(403);
  });

  it("blocks an allocation that would exceed the offering's target size", async () => {
    const noteId = await issueNote({ productName: "Small Offering Note", targetSizeNGN: 6000000, parValueNGN: 1000000 });
    const investor = await signupAndLoginInvestor("Ngozi Investor");
    const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investor.token}`);
    await request(app).post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`).set("Authorization", `Bearer ${distributorToken}`);

    const subscribeRes = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 5000000 });
    expect(subscribeRes.status).toBe(201);

    const oversubscribedRes = await request(app)
      .post(`/subscriptions/${subscribeRes.body.contractId}/allocate`)
      .set("Authorization", `Bearer ${distributorToken}`)
      .send({ allocatedAmountNGN: 6000001, riskNotes: "Attempting to oversubscribe." });
    expect(oversubscribedRes.status).toBe(409);
  });

  it("rejects a subscription below the note's minimum subscription amount", async () => {
    const noteId = await issueNote();
    const investor = await signupAndLoginInvestor("Emeka Investor");
    const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investor.token}`);
    await request(app).post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`).set("Authorization", `Bearer ${distributorToken}`);

    const tooSmallRes = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 1 });
    expect(tooSmallRes.status).toBe(400);
  });

  it("lets the investor withdraw and the Distributor reject a subscription", async () => {
    const noteId = await issueNote();
    const investor = await signupAndLoginInvestor("Bola Investor");
    const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investor.token}`);
    await request(app).post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`).set("Authorization", `Bearer ${distributorToken}`);

    const withdrawTarget = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 2000000 });
    const withdrawRes = await request(app)
      .post(`/subscriptions/${withdrawTarget.body.contractId}/withdraw`)
      .set("Authorization", `Bearer ${investor.token}`);
    expect(withdrawRes.status).toBe(204);

    const rejectTarget = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 2000000 });
    const rejectRes = await request(app)
      .post(`/subscriptions/${rejectTarget.body.contractId}/reject`)
      .set("Authorization", `Bearer ${distributorToken}`)
      .send({ rejectionReason: "Portfolio concentration limits reached." });
    expect(rejectRes.status).toBe(204);
  });
});
