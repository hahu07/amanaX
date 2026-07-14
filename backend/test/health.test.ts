import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";

describe("GET /health", () => {
  it("responds with backend ok and a ledger status", async () => {
    const res = await request(app).get("/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body.backend).toBe("ok");
    expect(res.body.ledger).toHaveProperty("reachable");
  });
});
