import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded AND the agents service on :4100, same as test/regulatory.test.ts.

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

async function createSecApproval(overrides?: {
  productName?: string;
  targetSizeNGN?: number;
  tenorMonths?: number;
}): Promise<string> {
  const proposeRes = await request(app)
    .post("/proposals")
    .set("Authorization", `Bearer ${fundManagerToken}`)
    .send({
      issuingHouse: issuingHouseParty,
      productName: overrides?.productName ?? "AmanaX Sukuk Note I",
      description: "A Shariah-compliant Ijarah-backed investment note.",
      proposedType: "Ijarah",
      targetSizeNGN: overrides?.targetSizeNGN ?? 500000000,
      tenorMonths: overrides?.tenorMonths ?? 24,
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
      structureTenorMonths: overrides?.tenorMonths ?? 24,
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
  return approveSecRes.body.contractId as string;
}

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;

  const fm = await onboardOrgAndLogin("FundManager", "Issuance Test FM");
  fundManagerToken = fm.token;

  const ih = await onboardOrgAndLogin("IssuingHouse", "Issuance Test IH");
  issuingHouseToken = ih.token;
  issuingHouseParty = ih.party;

  const sa = await onboardOrgAndLogin("ShariahAdvisor", "Issuance Test SA");
  shariahAdvisorToken = sa.token;
  shariahAdvisorParty = sa.party;

  const tr = await onboardOrgAndLogin("Trustee", "Issuance Test Trustee");
  trusteeToken = tr.token;
  trusteeParty = tr.party;

  const sec = await onboardOrgAndLogin("SEC", "Issuance Test SEC");
  secToken = sec.token;
  secParty = sec.party;
});

describe("Investment Note issuance", () => {
  it("issues a note from an SEC approval with a real InstrumentId and Metadata", async () => {
    const approvalId = await createSecApproval();

    const issueRes = await request(app)
      .post(`/sec-approvals/${approvalId}/issue`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ symbol: `AMX${Date.now()}`, parValueNGN: 1000000 });
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.instrumentId.admin).toBe(issuingHouseParty);
    expect(issueRes.body.instrumentId.id).toBe(issueRes.body.symbol);
    expect(issueRes.body.totalSupply).toBe(500);
    expect(issueRes.body.meta["amanax.io/name"]).toBe("AmanaX Sukuk Note I");
    expect(issueRes.body.meta["amanax.io/totalSupply"]).toBe("500");

    // sponsor, trustee, and SEC can all see the issued note (observers)
    const fmListRes = await request(app).get("/investment-notes").set("Authorization", `Bearer ${fundManagerToken}`);
    expect(fmListRes.body.some((n: { contractId: string }) => n.contractId === issueRes.body.contractId)).toBe(true);
    const trListRes = await request(app).get("/investment-notes").set("Authorization", `Bearer ${trusteeToken}`);
    expect(trListRes.body.some((n: { contractId: string }) => n.contractId === issueRes.body.contractId)).toBe(true);
    const secListRes = await request(app).get("/investment-notes").set("Authorization", `Bearer ${secToken}`);
    expect(secListRes.body.some((n: { contractId: string }) => n.contractId === issueRes.body.contractId)).toBe(true);

    // the dedicated Token Metadata endpoint returns just {instrumentId, meta}
    const metaRes = await request(app)
      .get(`/investment-notes/${issueRes.body.contractId}/metadata`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(metaRes.status).toBe(200);
    expect(metaRes.body).toEqual({ instrumentId: issueRes.body.instrumentId, meta: issueRes.body.meta });
  });

  it("rejects a non-Issuing-House party trying to issue (backend RBAC)", async () => {
    const approvalId = await createSecApproval();
    const res = await request(app)
      .post(`/sec-approvals/${approvalId}/issue`)
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({ symbol: `SHOULDFAIL${Date.now()}`, parValueNGN: 1000000 });
    expect(res.status).toBe(403);
  });

  it("blocks issuing the same approval twice", async () => {
    const approvalId = await createSecApproval();
    const symbol = `DUP${Date.now()}`;

    const firstRes = await request(app)
      .post(`/sec-approvals/${approvalId}/issue`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ symbol, parValueNGN: 1000000 });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post(`/sec-approvals/${approvalId}/issue`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ symbol: `${symbol}B`, parValueNGN: 1000000 });
    expect(secondRes.status).toBe(409);
  });

  it("blocks reusing a symbol already issued by the same Issuing House", async () => {
    const symbol = `TAKEN${Date.now()}`;
    const firstApprovalId = await createSecApproval();
    const firstIssueRes = await request(app)
      .post(`/sec-approvals/${firstApprovalId}/issue`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ symbol, parValueNGN: 1000000 });
    expect(firstIssueRes.status).toBe(201);

    const secondApprovalId = await createSecApproval({ productName: "A Different Note" });
    const secondIssueRes = await request(app)
      .post(`/sec-approvals/${secondApprovalId}/issue`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({ symbol, parValueNGN: 500000 });
    expect(secondIssueRes.status).toBe(409);
  });
});
