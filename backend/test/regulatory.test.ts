import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded AND the agents service on :4100, same as test/reviews.test.ts.

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

async function onboardOrgAndLogin(role: "FundManager" | "IssuingHouse" | "ShariahAdvisor" | "Trustee" | "SEC", label: string) {
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

async function createApprovedTrusteeReview(): Promise<string> {
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

  const approveRes = await request(app)
    .post(`/trustee-reviews/${submitTrusteeRes.body.contractId}/approve`)
    .set("Authorization", `Bearer ${trusteeToken}`)
    .send({ approvalNotes: "Governance and investor-protection terms are adequate for this issuance." });
  expect(approveRes.status).toBe(200);
  return approveRes.body.contractId as string;
}

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;

  const fm = await onboardOrgAndLogin("FundManager", "Regulatory Test FM");
  fundManagerToken = fm.token;

  const ih = await onboardOrgAndLogin("IssuingHouse", "Regulatory Test IH");
  issuingHouseToken = ih.token;
  issuingHouseParty = ih.party;

  const sa = await onboardOrgAndLogin("ShariahAdvisor", "Regulatory Test SA");
  shariahAdvisorToken = sa.token;
  shariahAdvisorParty = sa.party;

  const tr = await onboardOrgAndLogin("Trustee", "Regulatory Test Trustee");
  trusteeToken = tr.token;
  trusteeParty = tr.party;

  const sec = await onboardOrgAndLogin("SEC", "Regulatory Test SEC");
  secToken = sec.token;
  secParty = sec.party;
});

describe("Regulatory submission & SEC approval workflow", () => {
  it("previews a filing pack with all four document kinds", async () => {
    const trusteeReviewId = await createApprovedTrusteeReview();
    const res = await request(app)
      .post(`/trustee-reviews/${trusteeReviewId}/generate-filing-pack`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(res.status).toBe(200);
    expect(res.body.agent).toBe("documentation");
    expect(res.body.output.map((d: { kind: string }) => d.kind)).toEqual([
      "TermSheet",
      "InvestmentSummary",
      "ApprovalPack",
      "RegulatoryFiling",
    ]);
    expect(res.body.output[0].markdown).toContain("AmanaX Sukuk Note I");
  });

  it("runs the full lifecycle: submit to SEC -> approve", async () => {
    const trusteeReviewId = await createApprovedTrusteeReview();

    const submitRes = await request(app)
      .post(`/trustee-reviews/${trusteeReviewId}/submit-to-sec`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ sec: secParty });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe("Pending");
    expect(submitRes.body.documents).toHaveLength(4);

    const secListRes = await request(app).get("/regulatory-submissions").set("Authorization", `Bearer ${secToken}`);
    expect(secListRes.body.some((s: { contractId: string }) => s.contractId === submitRes.body.contractId)).toBe(true);

    // Fund Manager (sponsor) can't approve (backend RBAC)
    const forbiddenRes = await request(app)
      .post(`/regulatory-submissions/${submitRes.body.contractId}/approve`)
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({ approvalReference: "n/a" });
    expect(forbiddenRes.status).toBe(403);

    const approveRes = await request(app)
      .post(`/regulatory-submissions/${submitRes.body.contractId}/approve`)
      .set("Authorization", `Bearer ${secToken}`)
      .send({ approvalReference: "SEC/AMX/2026/0001" });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("Approved");
    expect(approveRes.body.approvalReference).toBe("SEC/AMX/2026/0001");

    // sponsor and trustee can both see the approval as observers
    const fmListRes = await request(app).get("/regulatory-submissions").set("Authorization", `Bearer ${fundManagerToken}`);
    expect(fmListRes.body.some((s: { contractId: string }) => s.contractId === approveRes.body.contractId)).toBe(true);
    const trListRes = await request(app).get("/regulatory-submissions").set("Authorization", `Bearer ${trusteeToken}`);
    expect(trListRes.body.some((s: { contractId: string }) => s.contractId === approveRes.body.contractId)).toBe(true);
  });

  it("rejects submission when the Compliance Agent isn't ready (thin approval notes)", async () => {
    const proposeRes = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Thin Notes Note",
        description: "Used to test the compliance gate on submission.",
        proposedType: "Murabahah",
        targetSizeNGN: 100000000,
        tenorMonths: 6,
      });
    const structureRes = await request(app)
      .post(`/proposals/${proposeRes.body.contractId}/structure`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({
        structureType: "Murabahah",
        profitMechanism: "Fixed cost-plus markup",
        minSubscriptionNGN: 100000,
        redemptionTerms: "Bullet",
        structureTenorMonths: 6,
      });
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
      .send({ certificationNotes: "OK" }); // deliberately thin (< 20 chars)
    const submitTrusteeRes = await request(app)
      .post(`/shariah-reviews/${certifyRes.body.contractId}/submit-trustee-review`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ trustee: trusteeParty });
    const approveRes = await request(app)
      .post(`/trustee-reviews/${submitTrusteeRes.body.contractId}/approve`)
      .set("Authorization", `Bearer ${trusteeToken}`)
      .send({ approvalNotes: "Fine" }); // deliberately thin

    const submitToSecRes = await request(app)
      .post(`/trustee-reviews/${approveRes.body.contractId}/submit-to-sec`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ sec: secParty });
    expect(submitToSecRes.status).toBe(409);
    expect(submitToSecRes.body.compliance.readyForSubmission).toBe(false);
    expect(submitToSecRes.body.compliance.shariahChecklistGaps.length).toBeGreaterThan(0);
  });

  it("lets the Issuing House withdraw and the SEC reject a submission", async () => {
    const trusteeReviewId1 = await createApprovedTrusteeReview();
    const withdrawTarget = await request(app)
      .post(`/trustee-reviews/${trusteeReviewId1}/submit-to-sec`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ sec: secParty });
    expect(withdrawTarget.status).toBe(201);
    const withdrawRes = await request(app)
      .post(`/regulatory-submissions/${withdrawTarget.body.contractId}/withdraw`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(withdrawRes.status).toBe(204);

    const trusteeReviewId2 = await createApprovedTrusteeReview();
    const rejectTarget = await request(app)
      .post(`/trustee-reviews/${trusteeReviewId2}/submit-to-sec`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ sec: secParty });
    const rejectRes = await request(app)
      .post(`/regulatory-submissions/${rejectTarget.body.contractId}/reject`)
      .set("Authorization", `Bearer ${secToken}`)
      .send({ rejectionReason: "Incomplete disclosure of underlying asset ownership." });
    expect(rejectRes.status).toBe(204);

    const listRes = await request(app).get("/regulatory-submissions").set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(listRes.body.some((s: { contractId: string }) => s.contractId === withdrawTarget.body.contractId)).toBe(false);
    expect(listRes.body.some((s: { contractId: string }) => s.contractId === rejectTarget.body.contractId)).toBe(false);
  });
});
