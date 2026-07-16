import { describe, it, expect } from "vitest";
import { runReportingAgent } from "../src/reporting/agent.js";
import type { ReportContext } from "../src/types.js";

function context(overrides: Partial<ReportContext>): ReportContext {
  return {
    reportType: "management",
    dealId: "deal-1",
    holdings: [],
    distributions: [],
    ...overrides,
  };
}

describe("runReportingAgent", () => {
  it("generates a management report grounded in real deal facts", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "management",
        productName: "AmanaX Sukuk Note I",
        symbol: "AMXSNI",
        structureType: "Ijarah",
        targetSizeNGN: 500_000_000,
        totalSupply: 500,
        approvalReference: "SEC/AMX/2026/0001",
        holdings: [{ investor: "alice", units: 10, amountNGN: 10_000_000 }],
        distributions: [{ amountNGN: 1_000_000 }, { amountNGN: 500_000 }],
      }),
    );
    expect(result.reportType).toBe("management");
    expect(result.markdown).toContain("AmanaX Sukuk Note I");
    expect(result.markdown).toContain("AMXSNI");
    expect(result.markdown).toContain("SEC/AMX/2026/0001");
    expect(result.markdown).toContain("₦1,500,000.00");
  });

  it("generates an investor report scoped to the investor's own holdings across notes", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "investor",
        generatedFor: "Amina Bello",
        holdings: [
          { productName: "Note A", symbol: "AMXA", units: 10, amountNGN: 10_000_000 },
          { productName: "Note B", symbol: "AMXB", units: 5, amountNGN: 5_000_000 },
        ],
        distributions: [{ productName: "Note A", periodLabel: "Q1 2026", amountNGN: 1_000_000 }],
      }),
    );
    expect(result.markdown).toContain("Amina Bello");
    expect(result.markdown).toContain("Note A");
    expect(result.markdown).toContain("Note B");
    expect(result.markdown).toContain("Q1 2026");
  });

  it("generates a compliance report reflecting a not-ready assessment", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "compliance",
        productName: "AmanaX Sukuk Note I",
        compliance: {
          readyForSubmission: false,
          missingDocuments: ["Trust Deed"],
          shariahChecklistGaps: ["Certification notes are minimal."],
          workflowGaps: ["Trustee review not yet completed."],
          blockingIssues: ["Trustee review not yet completed."],
        },
      }),
    );
    expect(result.markdown).toContain("**Ready for SEC submission:** No");
    expect(result.markdown).toContain("Trust Deed");
    expect(result.markdown).toContain("Trustee review not yet completed.");
  });

  it("generates a regulatory report with certification and approval history", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "regulatory",
        productName: "AmanaX Sukuk Note I",
        approvalReference: "SEC/AMX/2026/0001",
        certificationNotes: "Structure conforms to Ijarah principles.",
        approvalNotes: "Governance terms are adequate.",
        distributions: [{ amountNGN: 250_000 }],
      }),
    );
    expect(result.markdown).toContain("SEC/AMX/2026/0001");
    expect(result.markdown).toContain("Structure conforms to Ijarah principles.");
    expect(result.markdown).toContain("Governance terms are adequate.");
  });

  it("falls back gracefully when no facts are available yet", async () => {
    const result = await runReportingAgent(context({ reportType: "management" }));
    expect(result.markdown).toContain("Untitled Product");
    expect(result.markdown).toContain("TBD");
  });
});
