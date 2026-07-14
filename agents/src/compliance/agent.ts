import type { DealContext, ComplianceAssessment } from "../types.js";
import { ComplianceAssessmentSchema } from "../types.js";

// Milestone 0 stub — see productStructuring/agent.ts. Fleshed out in
// Milestone 3 (readiness checks) and gated in Milestone 4 (SEC-submission block).
export async function runComplianceAgent(context: DealContext): Promise<ComplianceAssessment> {
  const output: ComplianceAssessment = {
    readyForSubmission: false,
    missingDocuments: [],
    shariahChecklistGaps: [],
    workflowGaps: context.structure ? [] : ["ProductStructure not yet created"],
    blockingIssues: ["Milestone 0 placeholder — not yet backed by a model."],
  };
  return ComplianceAssessmentSchema.parse(output);
}
