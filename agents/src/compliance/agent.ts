import type { DealContext, ComplianceAssessment } from "../types.js";
import { ComplianceAssessmentSchema } from "../types.js";

// Milestone 3: a deterministic, rule-based readiness checker — not yet
// LLM-backed, same reasoning as productStructuring/agent.ts. Reads the
// Trustee-review-stage DealContext the backend builds in
// api/reviews.ts's compliance-check route: `structure` carries the deal
// terms forward (copied at each review stage, per Review.daml), and
// `shariahReview`/`trusteeReview` carry each stage's own notes.

type StructureFields = {
  productName?: string;
  structureType?: string;
};

type ShariahFields = { certificationNotes?: string };
type TrusteeFields = { approvalNotes?: string };

// Baseline documents every SEC Islamic-note filing needs, plus structure-
// specific documents grounded in what that instrument actually requires
// (e.g. an Ijarah note needs the underlying asset valued and leased, a
// Murabahah note needs the cost-plus purchase agreement). No document
// generation/tracking exists yet (that's the Documentation Agent,
// Milestone 4) — until then, this list is always the full requirement,
// not a placeholder for "some are already done".
const STANDARD_DOCUMENTS = ["Trust Deed", "Shariah Pronouncement", "Information Memorandum"];

const STRUCTURE_SPECIFIC_DOCUMENTS: Record<string, string[]> = {
  Murabahah: ["Murabahah Purchase Agreement"],
  Ijarah: ["Asset Valuation Report", "Lease Agreement"],
  Wakalah: ["Wakalah Agency Agreement"],
  Mudarabah: ["Mudarabah Profit-Sharing Agreement"],
};

const MIN_NOTE_LENGTH = 20;

export async function runComplianceAgent(context: DealContext): Promise<ComplianceAssessment> {
  const structure = context.structure as StructureFields | null;
  const shariahReview = context.shariahReview as ShariahFields | null;
  const trusteeReview = context.trusteeReview as TrusteeFields | null;

  const workflowGaps: string[] = [];
  if (!structure) {
    workflowGaps.push("Product structure not yet available.");
  }
  if (!shariahReview) {
    workflowGaps.push("Shariah review not yet completed.");
  }
  if (!trusteeReview) {
    workflowGaps.push("Trustee review not yet completed.");
  }
  if (trusteeReview && (trusteeReview.approvalNotes ?? "").trim().length < MIN_NOTE_LENGTH) {
    workflowGaps.push("Trustee approval notes are minimal — document the governance rationale in more detail.");
  }

  const shariahChecklistGaps: string[] = [];
  if (shariahReview && (shariahReview.certificationNotes ?? "").trim().length < MIN_NOTE_LENGTH) {
    shariahChecklistGaps.push(
      "Shariah certification notes are minimal — document the certification basis in more detail for the regulatory file.",
    );
  }

  // Informational, not blocking — Milestone 4's Documentation Agent is
  // what actually produces these, so their absence here isn't a workflow
  // failure, just a preview of what SEC submission (Step 8) will need.
  const missingDocuments: string[] =
    structure?.structureType != null
      ? [...STANDARD_DOCUMENTS, ...(STRUCTURE_SPECIFIC_DOCUMENTS[structure.structureType] ?? [])]
      : [];

  const blockingIssues = [...workflowGaps];

  const output: ComplianceAssessment = {
    readyForSubmission: blockingIssues.length === 0 && shariahChecklistGaps.length === 0,
    missingDocuments,
    shariahChecklistGaps,
    workflowGaps,
    blockingIssues,
  };
  return ComplianceAssessmentSchema.parse(output);
}
