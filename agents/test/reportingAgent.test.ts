import { describe, it, expect } from "vitest";
import { runReportingAgent } from "../src/reporting/agent.js";
import type { ReportContext } from "../src/types.js";

function context(overrides: Partial<ReportContext>): ReportContext {
  return {
    reportType: "management",
    dealId: "deal-1",
    holdings: [],
    distributions: [],
    investorProfiles: [],
    investmentNotes: [],
    distributionRequests: [],
    shariahReviews: [],
    organizations: [],
    users: [],
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

  it("generates a distributor portfolio report with KYC breakdown", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "portfolio",
        generatedFor: "Amana Distribution Partners",
        investorProfiles: [
          { fullName: "Yusuf Garba", email: "yusuf.garba@investor.ng", kycStatus: "KycVerified" },
          { fullName: "Bola Ahmed", email: "bola@investor.ng", kycStatus: "KycPending" },
        ],
        holdings: [{ investor: "yusuf", units: 5000, amountNGN: 5_000_000 }],
      }),
    );
    expect(result.reportType).toBe("portfolio");
    expect(result.markdown).toContain("Yusuf Garba");
    expect(result.markdown).toContain("KYC verified | 1");
    expect(result.markdown).toContain("KYC pending | 1");
    expect(result.markdown).toContain("₦5,000,000.00");
  });

  it("generates a custodian report reflecting notes and distributions administered", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "custody",
        generatedFor: "Amana Custody Bank",
        investmentNotes: [{ productName: "AmanaX Sukuk Note I", symbol: "AMXSNI", totalSupply: 500000 }],
        distributionRequests: [{ periodLabel: "Q2 2026" }],
        distributions: [{ amountNGN: 1_500_000 }],
      }),
    );
    expect(result.reportType).toBe("custody");
    expect(result.markdown).toContain("AmanaX Sukuk Note I");
    expect(result.markdown).toContain("Distribution requests pending Trustee approval | 1");
    expect(result.markdown).toContain("₦1,500,000.00");
  });

  it("generates a shariah advisor report summarizing certification history", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "shariah",
        generatedFor: "Amana Shariah Board",
        shariahReviews: [
          { productName: "AmanaX Sukuk Note I", structureType: "Wakalah", status: "Certified", certificationNotes: "Certified compliant." },
          { productName: "AmanaX Note II", structureType: "Ijarah", status: "Pending" },
        ],
      }),
    );
    expect(result.reportType).toBe("shariah");
    expect(result.markdown).toContain("Certified compliant | 1");
    expect(result.markdown).toContain("Pending certification | 1");
    expect(result.markdown).toContain("Certified compliant.");
  });

  it("generates a platform report summarizing organizations and users", async () => {
    const result = await runReportingAgent(
      context({
        reportType: "platform",
        organizations: [
          { name: "Amana Trading Ltd", role: "Issuer", active: true },
          { name: "Amana Finance Ltd", role: "IssuingHouse", active: true },
        ],
        users: [{ email: "rid@amana.ng" }, { email: "ade@amanafin.ng" }],
      }),
    );
    expect(result.reportType).toBe("platform");
    expect(result.markdown).toContain("Organizations onboarded | 2");
    expect(result.markdown).toContain("Users onboarded | 2");
    expect(result.markdown).toContain("| Issuer | 1 |");
  });
});
