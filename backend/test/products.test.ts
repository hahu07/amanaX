import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded, same as test/orgs.test.ts.

let operatorToken: string;
let fundManagerToken: string;
let fundManagerParty: string;
let issuingHouseToken: string;
let issuingHouseParty: string;

async function onboardOrgAndLogin(role: "FundManager" | "IssuingHouse" | "Issuer", label: string) {
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

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;

  const fm = await onboardOrgAndLogin("FundManager", "Products Test FM");
  fundManagerToken = fm.token;
  fundManagerParty = fm.party;

  const ih = await onboardOrgAndLogin("IssuingHouse", "Products Test IH");
  issuingHouseToken = ih.token;
  issuingHouseParty = ih.party;
});

describe("product proposal + structuring workflow", () => {
  it("proposes, structures, updates terms, and finalizes", async () => {
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
    expect(proposeRes.body.sponsor).toBe(fundManagerParty);
    expect(proposeRes.body.sponsorType).toBe("FundManager");
    expect(proposeRes.body.issuingHouse).toBe(issuingHouseParty);

    const fmListRes = await request(app).get("/proposals").set("Authorization", `Bearer ${fundManagerToken}`);
    expect(fmListRes.body.some((p: { contractId: string }) => p.contractId === proposeRes.body.contractId)).toBe(true);

    const ihListRes = await request(app).get("/proposals").set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(ihListRes.body.some((p: { contractId: string }) => p.contractId === proposeRes.body.contractId)).toBe(true);

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
    expect(structureRes.body.status).toBe("ProductStructure_Draft");

    // the proposal is consumed
    const fmListAfter = await request(app).get("/proposals").set("Authorization", `Bearer ${fundManagerToken}`);
    expect(fmListAfter.body.some((p: { contractId: string }) => p.contractId === proposeRes.body.contractId)).toBe(false);

    const structuresRes = await request(app).get("/structures").set("Authorization", `Bearer ${fundManagerToken}`);
    expect(structuresRes.body.some((s: { contractId: string }) => s.contractId === structureRes.body.contractId)).toBe(true);

    const updateRes = await request(app)
      .patch(`/structures/${structureRes.body.contractId}`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({
        newStructureType: "Ijarah",
        newProfitMechanism: "Lease rental distributed monthly",
        newMinSubscriptionNGN: 2000000,
        newRedemptionTerms: "Bullet redemption at maturity",
        newTenorMonths: 24,
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.minSubscriptionNGN).toBe(2000000);

    const finalizeRes = await request(app)
      .post(`/structures/${updateRes.body.contractId}/finalize`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.status).toBe("ProductStructure_Finalized");
  });

  it("rejects a Fund Manager trying to structure a proposal (backend RBAC)", async () => {
    const proposeRes = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Guarded Note",
        description: "Fund Manager should not be able to structure this.",
        proposedType: "Wakalah",
        targetSizeNGN: 100000,
        tenorMonths: 6,
      });
    expect(proposeRes.status).toBe(201);

    const forbiddenRes = await request(app)
      .post(`/proposals/${proposeRes.body.contractId}/structure`)
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        structureType: "Wakalah",
        profitMechanism: "n/a",
        minSubscriptionNGN: 0,
        redemptionTerms: "n/a",
        structureTenorMonths: 6,
      });
    expect(forbiddenRes.status).toBe(403);
  });

  it("returns an AI structuring recommendation for the Issuing House (requires the agents service running on :4100)", async () => {
    const proposeRes = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Trade Finance Note",
        description: "Short-term working capital financing for import trade settlement.",
        proposedType: "Murabahah",
        targetSizeNGN: 200000000,
        tenorMonths: 6,
      });
    expect(proposeRes.status).toBe(201);

    const recommendationRes = await request(app)
      .post(`/proposals/${proposeRes.body.contractId}/structuring-recommendation`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(recommendationRes.status).toBe(200);
    expect(recommendationRes.body.agent).toBe("product-structuring");
    expect(recommendationRes.body.output.recommendedStructureType).toBe("Murabahah");
    expect(recommendationRes.body.output.confidence).toBe("high");

    // Fund Manager can't request a recommendation (backend RBAC)
    const forbiddenRes = await request(app)
      .post(`/proposals/${proposeRes.body.contractId}/structuring-recommendation`)
      .set("Authorization", `Bearer ${fundManagerToken}`);
    expect(forbiddenRes.status).toBe(403);
  });

  it("lets the Fund Manager withdraw and the Issuing House reject a proposal", async () => {
    const withdrawTarget = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Withdrawn Note",
        description: "Will be withdrawn.",
        proposedType: "Murabahah",
        targetSizeNGN: 100000,
        tenorMonths: 6,
      });
    const withdrawRes = await request(app)
      .post(`/proposals/${withdrawTarget.body.contractId}/withdraw`)
      .set("Authorization", `Bearer ${fundManagerToken}`);
    expect(withdrawRes.status).toBe(204);

    const rejectTarget = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${fundManagerToken}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Rejected Note",
        description: "Will be rejected.",
        proposedType: "Mudarabah",
        targetSizeNGN: 100000,
        tenorMonths: 6,
      });
    const rejectRes = await request(app)
      .post(`/proposals/${rejectTarget.body.contractId}/reject`)
      .set("Authorization", `Bearer ${issuingHouseToken}`);
    expect(rejectRes.status).toBe(204);

    const listRes = await request(app).get("/proposals").set("Authorization", `Bearer ${fundManagerToken}`);
    expect(listRes.body.some((p: { contractId: string }) => p.contractId === withdrawTarget.body.contractId)).toBe(false);
    expect(listRes.body.some((p: { contractId: string }) => p.contractId === rejectTarget.body.contractId)).toBe(false);
  });

  it("lets a corporate Issuer (not just a Fund Manager) sponsor a proposal, with sponsorType recorded server-side", async () => {
    const issuer = await onboardOrgAndLogin("Issuer", "Products Test Issuer");

    const proposeRes = await request(app)
      .post("/proposals")
      .set("Authorization", `Bearer ${issuer.token}`)
      .send({
        issuingHouse: issuingHouseParty,
        productName: "Corporate Sukuk Financing",
        description: "Asset-backed Sukuk to finance the issuer's working capital.",
        proposedType: "Murabahah",
        targetSizeNGN: 750000000,
        tenorMonths: 12,
      });
    expect(proposeRes.status).toBe(201);
    expect(proposeRes.body.sponsor).toBe(issuer.party);
    expect(proposeRes.body.sponsorType).toBe("Issuer");

    const structureRes = await request(app)
      .post(`/proposals/${proposeRes.body.contractId}/structure`)
      .set("Authorization", `Bearer ${issuingHouseToken}`)
      .send({
        structureType: "Murabahah",
        profitMechanism: "Fixed cost-plus markup",
        minSubscriptionNGN: 5000000,
        redemptionTerms: "Bullet repayment at maturity",
        structureTenorMonths: 12,
      });
    expect(structureRes.status).toBe(201);
    expect(structureRes.body.sponsor).toBe(issuer.party);
    expect(structureRes.body.sponsorType).toBe("Issuer");
  });
});
