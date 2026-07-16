import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";

const baseContext = {
  dealId: "deal-1",
  proposal: null,
  structure: null,
  shariahReview: null,
  trusteeReview: null,
  checklist: [],
  documents: [],
  priorRecommendations: [],
};

describe("POST /internal/assistant/issuing-house/invoke", () => {
  it("routes intent=structure to the product structuring agent", async () => {
    const res = await request(app)
      .post("/internal/assistant/issuing-house/invoke")
      .send({ dealId: "deal-1", intent: "structure", context: baseContext });
    expect(res.status).toBe(200);
    expect(res.body.agent).toBe("product-structuring");
    expect(res.body.output.recommendedStructureType).toBeDefined();
  });

  it("routes intent=assess-compliance to the compliance agent", async () => {
    const res = await request(app)
      .post("/internal/assistant/issuing-house/invoke")
      .send({ dealId: "deal-1", intent: "assess-compliance", context: baseContext });
    expect(res.status).toBe(200);
    expect(res.body.agent).toBe("compliance");
    expect(res.body.output).toHaveProperty("readyForSubmission");
  });

  it("routes intent=generate-documents to the documentation agent, returning the full filing pack", async () => {
    const res = await request(app)
      .post("/internal/assistant/issuing-house/invoke")
      .send({ dealId: "deal-1", intent: "generate-documents", context: baseContext });
    expect(res.status).toBe(200);
    expect(res.body.agent).toBe("documentation");
    expect(Array.isArray(res.body.output)).toBe(true);
    expect(res.body.output.map((d: { kind: string }) => d.kind)).toEqual([
      "TermSheet",
      "InvestmentSummary",
      "ApprovalPack",
      "RegulatoryFiling",
    ]);
  });

  it("rejects a malformed request", async () => {
    const res = await request(app)
      .post("/internal/assistant/issuing-house/invoke")
      .send({ dealId: "deal-1", intent: "not-a-real-intent", context: baseContext });
    expect(res.status).toBe(400);
  });
});
