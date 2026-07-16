import { Router } from "express";
import { requireAuth, requireOrgParty, requireRole } from "../auth/middleware.js";
import { getOperatorParty } from "../ledger/operator.js";
import { listNotes } from "../ledger/issuance.js";
import { listSubscriptions, type InstrumentId } from "../ledger/subscriptions.js";
import { listProfitDistributions } from "../ledger/distributions.js";
import { findApprovedTrusteeReviewById } from "../ledger/reviews.js";
import { findApprovalById } from "../ledger/regulatory.js";
import { createComplianceReport, listComplianceReports } from "../ledger/complianceReports.js";
import { listAuditLog, logAuditEvent } from "../ledger/auditLog.js";
import { invokeIssuingHouseAssistant, invokeReportingAgent, type ComplianceAssessment, type DealContext } from "../agents/client.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

function instrumentMatches(a: InstrumentId, b: InstrumentId): boolean {
  return a.admin === b.admin && a.id === b.id;
}

// Management report (docs/prompt.md's Reporting Agent) — the Issuing
// House's own view of one deal's full lifecycle: issuance facts plus
// every subscription and distribution recorded against it. `holdings`/
// `distributions` are whatever the Issuing House's own party can see —
// it's an observer on every Allocation/ProfitDistribution for notes it
// issued (Milestones 6-7), so this is naturally complete.
reportsRouter.get("/investment-notes/:contractId/reports/management", requireRole("IssuingHouse"), async (req, res) => {
  const issuingHouse = requireOrgParty(req);
  const notes = await listNotes(issuingHouse);
  const note = notes.find((n) => n.contractId === req.params.contractId);
  if (!note) {
    res.status(404).json({ error: "investment note not found" });
    return;
  }

  const subscriptions = (await listSubscriptions(issuingHouse)).filter((s) => instrumentMatches(s.instrumentId, note.instrumentId));
  const distributions = (await listProfitDistributions(issuingHouse)).filter((d) => instrumentMatches(d.instrumentId, note.instrumentId));

  const response = await invokeReportingAgent({
    reportType: "management",
    dealId: note.contractId,
    productName: note.productName,
    symbol: note.symbol,
    structureType: note.structureType,
    targetSizeNGN: note.targetSizeNGN,
    totalSupply: note.totalSupply,
    approvalReference: note.approvalReference,
    holdings: subscriptions as unknown as Record<string, unknown>[],
    distributions: distributions as unknown as Record<string, unknown>[],
  });
  await logAuditEvent({
    actor: issuingHouse,
    kind: "ReportGenerated",
    agent: "reporting",
    summary: `Management report generated for ${note.productName}`,
    dealId: note.contractId,
  });
  res.status(200).json(response);
});

// Investor report — the investor's own portfolio (holdings + statements
// across every note), never another investor's; scoped by the investor's
// own party the same way GET /profit-distributions already is.
reportsRouter.get("/reports/investor", requireRole("Investor"), async (req, res) => {
  const investor = requireOrgParty(req);
  const subscriptions = await listSubscriptions(investor);
  const holdings = subscriptions.filter((s) => s.status === "Allocated");
  const distributions = await listProfitDistributions(investor);

  const response = await invokeReportingAgent({
    reportType: "investor",
    dealId: investor,
    generatedFor: req.auth!.displayName,
    holdings: holdings as unknown as Record<string, unknown>[],
    distributions: distributions as unknown as Record<string, unknown>[],
  });
  await logAuditEvent({
    actor: investor,
    kind: "ReportGenerated",
    agent: "reporting",
    summary: `Investor report generated for ${req.auth!.displayName}`,
    dealId: investor,
  });
  res.status(200).json(response);
});

// Compliance report: re-runs the Compliance Agent (same as the
// Milestone 3 preview) and, unlike that preview, persists the result
// on-ledger as a durable audit record. Generated at the Trustee-review
// stage — before SEC submission, before issuance — so it has no
// InstrumentId to reference yet (see ComplianceReport.daml's module
// comment).
reportsRouter.post("/trustee-reviews/:contractId/compliance-report", requireRole("IssuingHouse"), async (req, res) => {
  const issuingHouse = requireOrgParty(req);
  const trusteeReview = await findApprovedTrusteeReviewById(issuingHouse, req.params.contractId);
  if (!trusteeReview) {
    res.status(404).json({ error: "approved trustee review not found" });
    return;
  }

  const context: DealContext = {
    dealId: req.params.contractId,
    proposal: null,
    structure: trusteeReview as unknown as Record<string, unknown>,
    shariahReview: { certificationNotes: trusteeReview.certificationNotes },
    trusteeReview: { approvalNotes: trusteeReview.approvalNotes },
    checklist: [],
    documents: [],
    priorRecommendations: [],
  };
  const complianceRes = await invokeIssuingHouseAssistant({ dealId: req.params.contractId, intent: "assess-compliance", context });
  const compliance = complianceRes.output as ComplianceAssessment;

  const report = await createComplianceReport({
    issuingHouse,
    trustee: trusteeReview.trustee,
    sponsor: trusteeReview.sponsor,
    dealId: req.params.contractId,
    productName: trusteeReview.productName,
    readyForSubmission: compliance.readyForSubmission,
    workflowGaps: compliance.workflowGaps,
    shariahChecklistGaps: compliance.shariahChecklistGaps,
    missingDocuments: compliance.missingDocuments,
  });

  await logAuditEvent({
    actor: issuingHouse,
    kind: "ComplianceCheckPerformed",
    agent: "compliance",
    summary: `Compliance report persisted for ${trusteeReview.productName} — readyForSubmission: ${compliance.readyForSubmission}`,
    dealId: req.params.contractId,
  });

  const reportDoc = await invokeReportingAgent({
    reportType: "compliance",
    dealId: req.params.contractId,
    productName: trusteeReview.productName,
    compliance,
  });

  res.status(201).json({ report, document: reportDoc.output });
});

reportsRouter.get("/compliance-reports", requireRole("IssuingHouse", "Trustee", "FundManager", "Issuer"), async (req, res) => {
  const reports = await listComplianceReports(requireOrgParty(req));
  res.status(200).json(reports);
});

// Regulatory report: the SEC's own view of an approved note's compliance
// and distribution history. Naturally scoped by the caller's own party —
// SEC is not an observer on ProfitDistribution (a deliberate Milestone 7
// privacy boundary keeping per-investor payout amounts away from parties
// that aren't the investor/issuer/custodian/trustee), so a SEC-generated
// regulatory report shows approval history without per-investor detail;
// an Issuing-House-generated one is naturally more complete. See
// milestone-8.md Findings.
reportsRouter.get("/investment-notes/:contractId/reports/regulatory", requireRole("SEC", "IssuingHouse"), async (req, res) => {
  const party = requireOrgParty(req);
  const notes = await listNotes(party);
  const note = notes.find((n) => n.contractId === req.params.contractId);
  if (!note) {
    res.status(404).json({ error: "investment note not found" });
    return;
  }

  const distributions = (await listProfitDistributions(party)).filter((d) => instrumentMatches(d.instrumentId, note.instrumentId));
  const approval = await findApprovalById(party, note.approvalCid);

  const response = await invokeReportingAgent({
    reportType: "regulatory",
    dealId: note.contractId,
    productName: note.productName,
    symbol: note.symbol,
    targetSizeNGN: note.targetSizeNGN,
    totalSupply: note.totalSupply,
    approvalReference: note.approvalReference,
    certificationNotes: approval?.certificationNotes,
    approvalNotes: approval?.approvalNotes,
    distributions: distributions as unknown as Record<string, unknown>[],
  });
  await logAuditEvent({
    actor: party,
    kind: "ReportGenerated",
    agent: "reporting",
    summary: `Regulatory report generated for ${note.productName}`,
    dealId: note.contractId,
  });
  res.status(200).json(response);
});

// The full platform audit trail (PlatformOperator) vs. a role's own
// actions only (everyone else) — AuditLog's signatory/observer shape
// (operator, actor) does this scoping automatically; PlatformOperator has
// no org party of its own, so it reads via getOperatorParty() the same
// way every other operator-scoped read in this codebase does.
reportsRouter.get("/audit-log", requireAuth, async (req, res) => {
  const party = req.auth!.role === "PlatformOperator" ? await getOperatorParty() : requireOrgParty(req);
  const entries = await listAuditLog(party);
  res.status(200).json(entries);
});
