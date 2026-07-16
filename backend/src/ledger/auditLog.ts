import { queryActiveContracts, submitCreate, templateId } from "./commands.js";
import { getOperatorParty } from "./operator.js";

const AUDIT_LOG_TEMPLATE_ID = templateId("AmanaX.Audit.AuditLog", "AuditLog");

export const AUDIT_EVENT_KINDS = [
  "StructuringRecommendationShown",
  "ComplianceCheckPerformed",
  "DocumentGenerated",
  "RiskAssessmentPerformed",
  "ReportGenerated",
] as const;
export type AuditEventKind = (typeof AUDIT_EVENT_KINDS)[number];

export interface AuditLogEntry {
  contractId: string;
  operator: string;
  actor: string;
  kind: AuditEventKind;
  agent: string;
  summary: string;
  dealId: string;
  occurredAt: string;
}

function toEntry(contractId: string, arg: unknown): AuditLogEntry {
  const a = arg as Record<string, unknown>;
  return {
    contractId,
    operator: a.operator as string,
    actor: a.actor as string,
    kind: a.kind as AuditEventKind,
    agent: a.agent as string,
    summary: a.summary as string,
    dealId: a.dealId as string,
    occurredAt: a.occurredAt as string,
  };
}

// docs/implementation_plan.md §1: AuditLog is only for off-ledger events
// (AI recommendations shown, document generation, risk/compliance checks)
// the ledger's own transaction stream wouldn't otherwise capture — never
// duplicated for on-ledger state changes. Fire-and-forget from the
// caller's perspective is deliberately not offered here: every call site
// awaits this, so a failed audit write surfaces as a real error rather
// than silently vanishing (the same "don't paper over ledger failures"
// posture as every other write in this codebase).
export async function logAuditEvent(params: {
  actor: string;
  kind: AuditEventKind;
  agent: string;
  summary: string;
  dealId: string;
}): Promise<AuditLogEntry> {
  const operator = await getOperatorParty();
  const { contractId, createArgument } = await submitCreate({
    templateId: AUDIT_LOG_TEMPLATE_ID,
    actAs: [operator],
    createArguments: {
      operator,
      actor: params.actor,
      kind: params.kind,
      agent: params.agent,
      summary: params.summary,
      dealId: params.dealId,
      occurredAt: new Date().toISOString(),
    },
  });
  return toEntry(contractId, createArgument);
}

export async function listAuditLog(party: string): Promise<AuditLogEntry[]> {
  const contracts = await queryActiveContracts({ party, templateFilterId: AUDIT_LOG_TEMPLATE_ID });
  return contracts.map((c) => toEntry(c.contractId, c.createArgument)).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}
