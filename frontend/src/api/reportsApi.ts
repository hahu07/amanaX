import { apiFetch } from "./backendClient";

export type ReportType = "management" | "investor" | "compliance" | "regulatory";

export interface GeneratedReport {
  reportType: ReportType;
  title: string;
  markdown: string;
  sourceFacts: string[];
}

export interface ReportInvokeResponse {
  agent: "reporting";
  output: GeneratedReport;
  model: string;
  timestamp: string;
}

export interface ComplianceReportItem {
  contractId: string;
  issuingHouse: string;
  trustee: string;
  sponsor: string;
  dealId: string;
  productName: string;
  readyForSubmission: boolean;
  workflowGaps: string[];
  shariahChecklistGaps: string[];
  missingDocuments: string[];
  generatedAt: string;
}

export interface AuditLogEntry {
  contractId: string;
  operator: string;
  actor: string;
  kind: string;
  agent: string;
  summary: string;
  dealId: string;
  occurredAt: string;
}

export async function getManagementReport(token: string, noteContractId: string): Promise<ReportInvokeResponse> {
  return apiFetch<ReportInvokeResponse>(`/investment-notes/${noteContractId}/reports/management`, token);
}

export async function getInvestorReport(token: string): Promise<ReportInvokeResponse> {
  return apiFetch<ReportInvokeResponse>("/reports/investor", token);
}

export async function getRegulatoryReport(token: string, noteContractId: string): Promise<ReportInvokeResponse> {
  return apiFetch<ReportInvokeResponse>(`/investment-notes/${noteContractId}/reports/regulatory`, token);
}

export async function generateComplianceReport(
  token: string,
  trusteeReviewContractId: string,
): Promise<{ report: ComplianceReportItem; document: GeneratedReport }> {
  return apiFetch(`/trustee-reviews/${trusteeReviewContractId}/compliance-report`, token, { method: "POST" });
}

export async function listComplianceReports(token: string): Promise<ComplianceReportItem[]> {
  return apiFetch<ComplianceReportItem[]>("/compliance-reports", token);
}

export async function listAuditLog(token: string): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>("/audit-log", token);
}
