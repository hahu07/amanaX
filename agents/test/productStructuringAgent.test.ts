import { describe, it, expect } from "vitest";
import { runProductStructuringAgent } from "../src/productStructuring/agent.js";
import type { DealContext } from "../src/types.js";

function contextWithProposal(proposal: Record<string, unknown>): DealContext {
  return {
    dealId: "deal-1",
    proposal,
    structure: null,
    shariahReview: null,
    trusteeReview: null,
    checklist: [],
    documents: [],
    priorRecommendations: [],
  };
}

describe("runProductStructuringAgent", () => {
  it("recommends Murabahah for a short tenor and affirms a matching proposal", async () => {
    const result = await runProductStructuringAgent(
      contextWithProposal({
        productName: "Trade Finance Note",
        description: "Short-term working capital financing for import trade settlement.",
        proposedType: "Murabahah",
        targetSizeNGN: 200_000_000,
        tenorMonths: 6,
      }),
    );
    expect(result.recommendedStructureType).toBe("Murabahah");
    expect(result.confidence).toBe("high");
    expect(result.openGaps).toHaveLength(0);
  });

  it("recommends Ijarah for a medium tenor", async () => {
    const result = await runProductStructuringAgent(
      contextWithProposal({
        productName: "Equipment Lease Note",
        description: "Lease financing for industrial equipment used by SME manufacturers nationwide.",
        proposedType: "Ijarah",
        targetSizeNGN: 300_000_000,
        tenorMonths: 24,
      }),
    );
    expect(result.recommendedStructureType).toBe("Ijarah");
    expect(result.suggestedTerms.tenorMonths).toBe(24);
  });

  it("recommends Mudarabah for a long tenor", async () => {
    const result = await runProductStructuringAgent(
      contextWithProposal({
        productName: "Growth Capital Note",
        description: "Long-horizon profit-sharing capital for regional infrastructure development.",
        proposedType: "Mudarabah",
        targetSizeNGN: 1_000_000_000,
        tenorMonths: 48,
      }),
    );
    expect(result.recommendedStructureType).toBe("Mudarabah");
  });

  it("recommends Wakalah when the description signals a managed/agency mandate, overriding tenor", async () => {
    const result = await runProductStructuringAgent(
      contextWithProposal({
        productName: "Managed Portfolio Note",
        description: "An actively managed portfolio note run by an appointed agent on investors' behalf.",
        proposedType: "Murabahah",
        targetSizeNGN: 400_000_000,
        tenorMonths: 6,
      }),
    );
    expect(result.recommendedStructureType).toBe("Wakalah");
    expect(result.confidence).not.toBe("high");
    expect(result.openGaps.some((g) => g.includes("differs from the recommended type"))).toBe(true);
  });

  it("flags a too-brief description and an unusually small target size as open gaps", async () => {
    const result = await runProductStructuringAgent(
      contextWithProposal({
        productName: "Tiny Note",
        description: "Small note.",
        proposedType: "Murabahah",
        targetSizeNGN: 500_000,
        tenorMonths: 6,
      }),
    );
    expect(result.openGaps.some((g) => g.includes("too brief"))).toBe(true);
    expect(result.openGaps.some((g) => g.includes("unusually small"))).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("falls back to a low-confidence placeholder when no proposal is supplied", async () => {
    const result = await runProductStructuringAgent({ ...contextWithProposal({}), proposal: null });
    expect(result.confidence).toBe("low");
    expect(result.openGaps).toContain("No proposal supplied");
  });
});
