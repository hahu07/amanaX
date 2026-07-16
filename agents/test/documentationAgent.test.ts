import { describe, it, expect } from "vitest";
import { runDocumentationAgent } from "../src/documentation/agent.js";
import type { DealContext } from "../src/types.js";

function context(overrides: Partial<DealContext>): DealContext {
  return {
    dealId: "deal-1",
    proposal: null,
    structure: null,
    shariahReview: null,
    trusteeReview: null,
    checklist: [],
    documents: [],
    priorRecommendations: [],
    ...overrides,
  };
}

const structure = {
  productName: "AmanaX Sukuk Note I",
  description: "A Shariah-compliant Ijarah-backed investment note.",
  structureType: "Ijarah",
  targetSizeNGN: 500_000_000,
  tenorMonths: 24,
  profitMechanism: "Quarterly lease rental",
  minSubscriptionNGN: 1_000_000,
  redemptionTerms: "Sale-and-leaseback unwind at maturity",
};

describe("runDocumentationAgent", () => {
  it("generates all four documents in a fixed order", async () => {
    const docs = await runDocumentationAgent(context({ structure }));
    expect(docs.map((d) => d.kind)).toEqual(["TermSheet", "InvestmentSummary", "ApprovalPack", "RegulatoryFiling"]);
  });

  it("grounds the term sheet in the real structure fields, not placeholders", async () => {
    const [termSheet] = await runDocumentationAgent(context({ structure }));
    expect(termSheet.markdown).toContain("AmanaX Sukuk Note I");
    expect(termSheet.markdown).toContain("Ijarah");
    expect(termSheet.markdown).toContain("24 months");
    expect(termSheet.markdown).toContain("Quarterly lease rental");
    expect(termSheet.markdown).toContain("₦500,000,000");
    expect(termSheet.sourceFacts).toContain("targetSizeNGN");
  });

  it("bundles the Shariah certification and Trustee approval notes into the approval pack", async () => {
    const docs = await runDocumentationAgent(
      context({
        structure,
        shariahReview: { certificationNotes: "Conforms to Ijarah principles." },
        trusteeReview: { approvalNotes: "Governance terms are adequate." },
      }),
    );
    const approvalPack = docs.find((d) => d.kind === "ApprovalPack")!;
    expect(approvalPack.markdown).toContain("Conforms to Ijarah principles.");
    expect(approvalPack.markdown).toContain("Governance terms are adequate.");
  });

  it("flags missing certification/approval notes rather than inventing them", async () => {
    const docs = await runDocumentationAgent(context({ structure }));
    const approvalPack = docs.find((d) => d.kind === "ApprovalPack")!;
    expect(approvalPack.markdown).toContain("Not yet certified");
    expect(approvalPack.markdown).toContain("Not yet approved");
  });

  it("falls back gracefully when structure is entirely absent", async () => {
    const docs = await runDocumentationAgent(context({}));
    expect(docs).toHaveLength(4);
    expect(docs[0].markdown).toContain("Untitled Product");
  });
});
