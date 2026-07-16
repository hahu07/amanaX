import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded AND the agents service on :4100, same as test/distributions.test.ts.

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

async function onboardOrgAndLogin(
  role: "FundManager" | "IssuingHouse" | "ShariahAdvisor" | "Trustee" | "SEC" | "Distributor",
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

async function createApprovedTrusteeReview(productName: string): Promise<string> {
  const proposeRes = await request(app)
    .post("/proposals")
    .set("Authorization", `Bearer ${fundManagerToken}`)
    .send({
      issuingHouse: issuingHouseParty,
      productName,
      description: "A Shariah-compliant Ijarah-backed investment note.",
      proposedType: "Ijarah",
      targetSizeNGN: 100000000,
      tenorMonths: 24,
    });
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
  expect(approveTrusteeRes.status).toBe(200);
  return approveTrusteeRes.body.contractId as string;
}

async function issueNote(productName: string): Promise<string> {
  const trusteeReviewId = await createApprovedTrusteeReview(productName);
  const submitSecRes = await request(app)
    .post(`/trustee-reviews/${trusteeReviewId}/submit-to-sec`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ sec: secParty });
  const approveSecRes = await request(app)
    .post(`/regulatory-submissions/${submitSecRes.body.contractId}/approve`)
    .set("Authorization", `Bearer ${secToken}`)
    .send({ approvalReference: `SEC/AMX/${Date.now()}` });
  const issueRes = await request(app)
    .post(`/sec-approvals/${approveSecRes.body.contractId}/issue`)
    .set("Authorization", `Bearer ${issuingHouseToken}`)
    .send({ symbol: `AMX${Date.now()}`, parValueNGN: 1000000 });
  expect(issueRes.status).toBe(201);
  return issueRes.body.contractId as string;
}

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;

  const fm = await onboardOrgAndLogin("FundManager", "Reports Test FM");
  fundManagerToken = fm.token;

  const ih = await onboardOrgAndLogin("IssuingHouse", "Reports Test IH");
  issuingHouseToken = ih.token;
  issuingHouseParty = ih.party;

  const sa = await onboardOrgAndLogin("ShariahAdvisor", "Reports Test SA");
  shariahAdvisorToken = sa.token;
  shariahAdvisorParty = sa.party;

  const tr = await onboardOrgAndLogin("Trustee", "Reports Test Trustee");
  trusteeToken = tr.token;
  trusteeParty = tr.party;

  const sec = await onboardOrgAndLogin("SEC", "Reports Test SEC");
  secToken = sec.token;
  secParty = sec.party;

  const dist = await onboardOrgAndLogin("Distributor", "Reports Test Dist");
  distributorToken = dist.token;
  distributorParty = dist.party;
});

describe("Reporting & compliance", () => {
  it("generates a management report reflecting real subscriptions and distributions", async () => {
    const noteId = await issueNote("Management Report Note");
    const investor = await signupAndLoginInvestor("Reports Investor A");
    const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investor.token}`);
    await request(app).post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`).set("Authorization", `Bearer ${distributorToken}`);
    const subRes = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 10000000 });
    await request(app)
      .post(`/subscriptions/${subRes.body.contractId}/allocate`)
      .set("Authorization", `Bearer ${distributorToken}`)
      .send({ allocatedAmountNGN: 10000000, riskNotes: "OK." });

    const reportRes = await request(app)
      .get(`/investment-notes/${noteId}/reports/management`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.agent).toBe("reporting");
    expect(reportRes.body.output.reportType).toBe("management");
    expect(reportRes.body.output.markdown).toContain("Management Report Note");
    expect(reportRes.body.output.markdown).toContain("Investor holdings recorded | 1");
  });

  it("generates an investor report scoped to the investor's own portfolio", async () => {
    const noteId = await issueNote("Investor Report Note");
    const investor = await signupAndLoginInvestor("Reports Investor B");
    const profilesRes = await request(app).get("/investor-profiles").set("Authorization", `Bearer ${investor.token}`);
    await request(app).post(`/investor-profiles/${profilesRes.body[0].contractId}/verify`).set("Authorization", `Bearer ${distributorToken}`);
    const subRes = await request(app)
      .post(`/investment-notes/${noteId}/subscribe`)
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ amountNGN: 2000000 });
    await request(app)
      .post(`/subscriptions/${subRes.body.contractId}/allocate`)
      .set("Authorization", `Bearer ${distributorToken}`)
      .send({ allocatedAmountNGN: 2000000, riskNotes: "OK." });

    const reportRes = await request(app).get("/reports/investor").set("Authorization", `Bearer ${investor.token}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.output.reportType).toBe("investor");
    expect(reportRes.body.output.markdown).toContain("Investor Report Note");
  });

  it("persists a compliance report visible to the Issuing House and Trustee, and lists it", async () => {
    const trusteeReviewId = await createApprovedTrusteeReview("Compliance Report Note");
    const createRes = await request(app)
      .post(`/trustee-reviews/${trusteeReviewId}/compliance-report`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(createRes.status).toBe(201);
    expect(createRes.body.report.readyForSubmission).toBe(true);
    expect(createRes.body.document.markdown).toContain("Compliance Report Note");

    const ihListRes = await request(app).get("/compliance-reports").set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(ihListRes.body.some((r: { contractId: string }) => r.contractId === createRes.body.report.contractId)).toBe(true);

    const trusteeListRes = await request(app).get("/compliance-reports").set("Authorization", `Bearer ${trusteeToken}`);
    expect(trusteeListRes.body.some((r: { contractId: string }) => r.contractId === createRes.body.report.contractId)).toBe(true);
  });

  it("generates a regulatory report for SEC and rejects a non-authorized role", async () => {
    const noteId = await issueNote("Regulatory Report Note");
    const secReportRes = await request(app)
      .get(`/investment-notes/${noteId}/reports/regulatory`)
      .set("Authorization", `Bearer ${secToken}`);
    expect(secReportRes.status).toBe(200);
    expect(secReportRes.body.output.markdown).toContain("Regulatory Report Note");

    const forbiddenRes = await request(app)
      .get(`/investment-notes/${noteId}/reports/regulatory`)
      .set("Authorization", `Bearer ${trusteeToken}`);
    expect(forbiddenRes.status).toBe(403);
  });

  it("records AuditLog entries for AI-agent invocations, scoped per party", async () => {
    const proposeRes = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Audit Log Note",
        description: "Used to test AuditLog recording.",
        proposedType: "Murabahah",
        targetSizeNGN: 50000000,
        tenorMonths: 6,
      });
    const recRes = await request(app)
      .post(`/proposals/${proposeRes.body.contractId}/structuring-recommendation`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(recRes.status).toBe(200);

    const operatorLogRes = await request(app).get("/audit-log").set("Authorization", `Bearer ${operatorToken}`);
    expect(operatorLogRes.status).toBe(200);
    const entry = operatorLogRes.body.find(
      (e: { dealId: string; kind: string }) => e.dealId === proposeRes.body.contractId && e.kind === "StructuringRecommendationShown",
    );
    expect(entry).toBeDefined();

    const ihLogRes = await request(app).get("/audit-log").set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(ihLogRes.body.some((e: { contractId: string }) => e.contractId === entry.contractId)).toBe(true);

    const fmLogRes = await request(app).get("/audit-log").set("Authorization", `Bearer ${fundManagerToken}`);
    expect(fmLogRes.body.some((e: { contractId: string }) => e.contractId === entry.contractId)).toBe(false);
  });
});
