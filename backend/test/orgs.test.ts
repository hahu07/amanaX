import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";
import { config } from "../src/config.js";

// Integration tests — require a live `dpm sandbox` with the amanax-main DAR
// loaded (see docs/milestones/milestone-0.md "How to run this locally").
// Unlike the health test, these can't degrade gracefully: onboarding
// requires a real ledger, so a failure here most likely means the sandbox
// isn't running rather than a real regression.

let operatorToken: string;

beforeAll(async () => {
  const res = await request(app).post("/auth/login").send({ email: config.operatorEmail });
  expect(res.status).toBe(200);
  operatorToken = res.body.token;
});

describe("RBAC", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/orgs");
    expect(res.status).toBe(401);
  });

  it("rejects a token for the wrong role", async () => {
    const loginRes = await request(app).post("/auth/login").send({ email: "not-a-real-user@example.com" });
    expect(loginRes.status).toBe(401);
  });

  it("rejects a non-operator role from onboarding an organization (backend RBAC, not just the frontend route guard)", async () => {
    const orgRes = await request(app)
      .post("/orgs")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ name: `RBAC Probe Co ${Date.now()}`, role: "FundManager" });
    expect(orgRes.status).toBe(201);

    const email = `rbac-probe-${Date.now()}@example.com`;
    await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ org: orgRes.body.party, userId: email, email, displayName: "RBAC Probe", role: "FundManager" });

    const userLoginRes = await request(app).post("/auth/login").send({ email });
    const userToken = userLoginRes.body.token;

    const forbiddenRes = await request(app)
      .post("/orgs")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "Should not be created", role: "FundManager" });
    expect(forbiddenRes.status).toBe(403);
  });
});

describe("org + user onboarding", () => {
  it("onboards an organization and a user for it", async () => {
    const orgRes = await request(app)
      .post("/orgs")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ name: `FundManager Test Co ${Date.now()}`, role: "FundManager" });
    expect(orgRes.status).toBe(201);
    expect(orgRes.body.role).toBe("FundManager");
    expect(orgRes.body.active).toBe(true);

    const listRes = await request(app).get("/orgs").set("Authorization", `Bearer ${operatorToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((o: { contractId: string }) => o.contractId === orgRes.body.contractId)).toBe(true);

    const email = `fm-user-${Date.now()}@example.com`;
    const userRes = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        org: orgRes.body.party,
        userId: `fm-user-${Date.now()}`,
        email,
        displayName: "FM Contact",
        role: "FundManager",
      });
    expect(userRes.status).toBe(201);

    const usersRes = await request(app)
      .get("/users")
      .query({ org: orgRes.body.party })
      .set("Authorization", `Bearer ${operatorToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.some((u: { email: string }) => u.email === email)).toBe(true);

    const userLoginRes = await request(app).post("/auth/login").send({ email });
    expect(userLoginRes.status).toBe(200);
    expect(userLoginRes.body.role).toBe("FundManager");
    expect(userLoginRes.body.org).toBe(orgRes.body.party);
  });

  it("deactivates and reactivates an organization", async () => {
    const orgRes = await request(app)
      .post("/orgs")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ name: `Trustee Test Co ${Date.now()}`, role: "Trustee" });
    expect(orgRes.status).toBe(201);

    const deactivateRes = await request(app)
      .patch(`/orgs/${orgRes.body.contractId}/active`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ active: false });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.active).toBe(false);
  });
});
