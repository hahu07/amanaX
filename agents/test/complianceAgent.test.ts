import { describe, it, expect } from "vitest";
import { runComplianceAgent } from "../src/compliance/agent.js";
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

describe("runComplianceAgent", () => {
  it("flags every stage as an open workflow gap when nothing has happened yet", async () => {
    const result = await runComplianceAgent(context({}));
    expect(result.readyForSubmission).toBe(false);
    expect(result.workflowGaps).toContain("Product structure not yet available.");
    expect(result.workflowGaps).toContain("Shariah review not yet completed.");
    expect(result.workflowGaps).toContain("Trustee review not yet completed.");
    expect(result.missingDocuments).toHaveLength(0);
  });

  it("is ready for submission once structure, Shariah, and Trustee are all in place with substantive notes", async () => {
    const result = await runComplianceAgent(
      context({
        structure: { productName: "AmanaX Sukuk Note I", structureType: "Ijarah" },
        shariahReview: { certificationNotes: "Structure conforms to Ijarah principles; no interest-bearing elements found." },
        trusteeReview: { approvalNotes: "Governance and investor-protection terms reviewed and found adequate for this issuance." },
      }),
    );
    expect(result.readyForSubmission).toBe(true);
    expect(result.workflowGaps).toHaveLength(0);
    expect(result.shariahChecklistGaps).toHaveLength(0);
    expect(result.blockingIssues).toHaveLength(0);
  });

  it("flags minimal certification/approval notes as gaps even when all three stages exist", async () => {
    const result = await runComplianceAgent(
      context({
        structure: { productName: "Thin Note", structureType: "Murabahah" },
        shariahReview: { certificationNotes: "OK" },
        trusteeReview: { approvalNotes: "Fine" },
      }),
    );
    expect(result.readyForSubmission).toBe(false);
    expect(result.shariahChecklistGaps.length).toBeGreaterThan(0);
    expect(result.workflowGaps.some((g) => g.includes("Trustee approval notes are minimal"))).toBe(true);
  });

  it("returns a structure-specific document checklist, not a generic one", async () => {
    const ijarah = await runComplianceAgent(context({ structure: { structureType: "Ijarah" } }));
    expect(ijarah.missingDocuments).toContain("Asset Valuation Report");
    expect(ijarah.missingDocuments).toContain("Trust Deed");

    const murabahah = await runComplianceAgent(context({ structure: { structureType: "Murabahah" } }));
    expect(murabahah.missingDocuments).toContain("Murabahah Purchase Agreement");
    expect(murabahah.missingDocuments).not.toContain("Asset Valuation Report");
  });

  it("missing documents alone (structure/shariah/trustee all present) does not block readiness", async () => {
    const result = await runComplianceAgent(
      context({
        structure: { productName: "AmanaX Sukuk Note I", structureType: "Wakalah" },
        shariahReview: { certificationNotes: "Structure conforms to Wakalah principles with a clear agency mandate." },
        trusteeReview: { approvalNotes: "Governance terms reviewed and found adequate for this issuance structure." },
      }),
    );
    expect(result.missingDocuments.length).toBeGreaterThan(0);
    expect(result.readyForSubmission).toBe(true);
  });
});
