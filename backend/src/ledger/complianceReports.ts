import { queryActiveContracts, submitCreate, templateId } from "./commands.js";

const REPORT_TEMPLATE_ID = templateId("AmanaX.Compliance.ComplianceReport", "ComplianceReport");

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

function toReport(contractId: string, arg: unknown): ComplianceReportItem {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    issuingHouse: a.issuingHouse as string,
    trustee: a.trustee as string,
    sponsor: a.sponsor as string,
    dealId: a.dealId as string,
    productName: a.productName as string,
    readyForSubmission: a.readyForSubmission as boolean,
    workflowGaps: (a.workflowGaps as string[]) ?? [],
    shariahChecklistGaps: (a.shariahChecklistGaps as string[]) ?? [],
    missingDocuments: (a.missingDocuments as string[]) ?? [],
    generatedAt: a.generatedAt as string,
  };
}

export async function createComplianceReport(params: {
  issuingHouse: string;
  trustee: string;
  sponsor: string;
  dealId: string;
  productName: string;
  readyForSubmission: boolean;
  workflowGaps: string[];
  shariahChecklistGaps: string[];
  missingDocuments: string[];
}): Promise<ComplianceReportItem> {
  const { contractId, createArgument } = await submitCreate({
    templateId: REPORT_TEMPLATE_ID,
    actAs: [params.issuingHouse],
    createArguments: {
      issuingHouse: params.issuingHouse,
      trustee: params.trustee,
      sponsor: params.sponsor,
      dealId: params.dealId,
      productName: params.productName,
      readyForSubmission: params.readyForSubmission,
      workflowGaps: params.workflowGaps,
      shariahChecklistGaps: params.shariahChecklistGaps,
      missingDocuments: params.missingDocuments,
      generatedAt: new Date().toISOString(),
    },
  });
  return toReport(contractId, createArgument);
}

export async function listComplianceReports(party: string): Promise<ComplianceReportItem[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: REPORT_TEMPLATE_ID });
  return contracts.map((c) => toReport(c.contractId, c.createArgument));
}
