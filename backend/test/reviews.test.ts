import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded AND the agents service on :4100 (for the compliance-check test),
// same as test/products.test.ts.

let operatorToken: string;
let fundManagerToken: string;
let issuingHouseToken: string;
let issuingHouseParty: string;
let shariahAdvisorToken: string;
let shariahAdvisorParty: string;
let trusteeToken: string;
let trusteeParty: string;

async function onboardOrgAndLogin(role: "FundManager" | "IssuingHouse" | "ShariahAdvisor" | "Trustee", label: string) {
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

async function createFinalizedStructure(): Promise<string> {
  const proposeRes = await request(app)
    .post("/proposals")
    .set("Authorization", `Bearer ${fundManagerToken}`)
    .send({
      issuingHouse: issuingHouseParty,
      productName: "AmanaX Sukuk Note I",
      description: "A Shariah-compliant Ijarah-backed investment note.",
      proposedType: "Ijarah",
      targetSizeNGN: 500000000,
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
  return finalizeRes.body.contractId as string;
}

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;

  const fm = await onboardOrgAndLogin("FundManager", "Reviews Test FM");
  fundManagerToken = fm.token;

  const ih = await onboardOrgAndLogin("IssuingHouse", "Reviews Test IH");
  issuingHouseToken = ih.token;
  issuingHouseParty = ih.party;

  const sa = await onboardOrgAndLogin("ShariahAdvisor", "Reviews Test SA");
  shariahAdvisorToken = sa.token;
  shariahAdvisorParty = sa.party;

  const tr = await onboardOrgAndLogin("Trustee", "Reviews Test Trustee");
  trusteeToken = tr.token;
  trusteeParty = tr.party;
});

describe("Shariah & Trustee review workflow", () => {
  it("rejects submitting a non-Finalized structure for Shariah review", async () => {
    const proposeRes = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Draft Note",
        description: "Still a draft.",
        proposedType: "Murabahah",
        targetSizeNGN: 100000,
        tenorMonths: 6,
      });
    const structureRes = await request(app)
      .post(`/proposals/${proposeRes.body.contractId}/structure`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({
        structureType: "Murabahah",
        profitMechanism: "Fixed markup",
        minSubscriptionNGN: 10000,
        redemptionTerms: "Bullet",
        structureTenorMonths: 6,
      });

    const forbiddenRes = await request(app)
      .post(`/structures/${structureRes.body.contractId}/submit-shariah-review`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ shariahAdvisor: "not-used" });
    expect(forbiddenRes.status).toBe(409);
  });

  it("runs the full lifecycle: Shariah certify -> Trustee approve -> compliance check", async () => {
    const structureId = await createFinalizedStructure();

    const submitShariahRes = await request(app)
      .post(`/structures/${structureId}/submit-shariah-review`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ shariahAdvisor: shariahAdvisorParty });
    expect(submitShariahRes.status).toBe(201);
    expect(submitShariahRes.body.status).toBe("Pending");

    const shariahListRes = await request(app).get("/shariah-reviews").set("Authorization", `Bearer ${shariahAdvisorToken}`);
    expect(shariahListRes.body.some((r: { contractId: string }) => r.contractId === submitShariahRes.body.contractId)).toBe(true);

    // Fund Manager cannot certify (backend RBAC)
    const forbiddenCertify = await request(app)
      .post(`/shariah-reviews/${submitShariahRes.body.contractId}/certify`)
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({ certificationNotes: "n/a" });
    expect(forbiddenCertify.status).toBe(403);

    const certifyRes = await request(app)
      .post(`/shariah-reviews/${submitShariahRes.body.contractId}/certify`)
      .set("Authorization", `Bearer ${shariahAdvisorToken}`)
      .send({ certificationNotes: "Structure conforms to Ijarah principles; no interest-bearing elements found." });
    expect(certifyRes.status).toBe(200);
    expect(certifyRes.body.status).toBe("Certified");

    // Trustee review can't start from the pending request id (only from the certified one)
    const submitTrusteeRes = await request(app)
      .post(`/shariah-reviews/${certifyRes.body.contractId}/submit-trustee-review`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ trustee: trusteeParty });
    expect(submitTrusteeRes.status).toBe(201);
    expect(submitTrusteeRes.body.status).toBe("Pending");
    expect(submitTrusteeRes.body.certificationNotes).toContain("Ijarah principles");

    const trusteeListRes = await request(app).get("/trustee-reviews").set("Authorization", `Bearer ${trusteeToken}`);
    expect(trusteeListRes.body.some((r: { contractId: string }) => r.contractId === submitTrusteeRes.body.contractId)).toBe(true);

    const approveRes = await request(app)
      .post(`/trustee-reviews/${submitTrusteeRes.body.contractId}/approve`)
      .set("Authorization", `Bearer ${trusteeToken}`)
      .send({ approvalNotes: "Governance and investor-protection terms are adequate for this issuance." });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("Approved");

    const complianceRes = await request(app)
      .post(`/trustee-reviews/${approveRes.body.contractId}/compliance-check`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(complianceRes.status).toBe(200);
    expect(complianceRes.body.agent).toBe("compliance");
    expect(complianceRes.body.output.readyForSubmission).toBe(true);
    expect(complianceRes.body.output.missingDocuments).toContain("Trust Deed");
  });

  it("lets the Shariah Advisor reject and the Issuing House withdraw a review request", async () => {
    const structureId = await createFinalizedStructure();

    const rejectTarget = await request(app)
      .post(`/structures/${structureId}/submit-shariah-review`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ shariahAdvisor: shariahAdvisorParty });
    const rejectRes = await request(app)
      .post(`/shariah-reviews/${rejectTarget.body.contractId}/reject`)
      .set("Authorization", `Bearer ${shariahAdvisorToken}`)
      .send({ rejectionReason: "Profit mechanism resembles fixed interest, not a genuine cost-plus sale." });
    expect(rejectRes.status).toBe(204);

    const structureId2 = await createFinalizedStructure();
    const withdrawTarget = await request(app)
      .post(`/structures/${structureId2}/submit-shariah-review`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ shariahAdvisor: shariahAdvisorParty });
    const withdrawRes = await request(app)
      .post(`/shariah-reviews/${withdrawTarget.body.contractId}/withdraw`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(withdrawRes.status).toBe(204);

    const listRes = await request(app).get("/shariah-reviews").set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(listRes.body.some((r: { contractId: string }) => r.contractId === rejectTarget.body.contractId)).toBe(false);
    expect(listRes.body.some((r: { contractId: string }) => r.contractId === withdrawTarget.body.contractId)).toBe(false);
  });
});
