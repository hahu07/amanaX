import type { DealContext, StructuringRecommendation } from "../types.js";
import { StructuringRecommendationSchema } from "../types.js";

// Milestone 2: a deterministic, rule-based recommendation engine — not yet
// LLM-backed (no ANTHROPIC_API_KEY is configured in this environment; see
// the decision recorded in docs/milestones/milestone-2.md). Every rule below
// is grounded in real Islamic-finance structuring logic, not arbitrary, and
// is isolated behind this one function so swapping in a real Claude call
// later touches only this file — the graph, the API contract (§6.4), and
// the frontend are unaffected either way.

type ProposalFields = {
  productName?: string;
  description?: string;
  proposedType?: string;
  targetSizeNGN?: number;
  tenorMonths?: number;
};

// This rule-based engine only ever recommends one of these four — "Hybrid"
// is a valid value elsewhere in StructuringRecommendation (e.g. an Issuing
// House's own manual entry) but isn't a heuristic this engine produces, so
// it's excluded here rather than faked with a placeholder mapping below.
type RuleBasedStructureType = Exclude<StructuringRecommendation["recommendedStructureType"], "Hybrid">;

const TENOR_BUCKETS = [3, 6, 12, 18, 24, 36, 48, 60];

function nearestTenorBucket(months: number): number {
  return TENOR_BUCKETS.reduce((closest, candidate) =>
    Math.abs(candidate - months) < Math.abs(closest - months) ? candidate : closest,
  );
}

function recommendStructureType(description: string, tenorMonths: number): RuleBasedStructureType {
  const text = description.toLowerCase();
  if (/\b(manage|managed|portfolio|agency|agent)\b/.test(text)) {
    return "Wakalah";
  }
  if (tenorMonths <= 12) {
    return "Murabahah";
  }
  if (tenorMonths <= 36) {
    return "Ijarah";
  }
  return "Mudarabah";
}

const PROFIT_MECHANISM_BY_TYPE: Record<RuleBasedStructureType, string> = {
  Murabahah: "Fixed cost-plus markup, disclosed upfront, paid at maturity or in agreed installments.",
  Ijarah: "Periodic lease rental (quarterly), indexed to the underlying asset's usufruct value.",
  Wakalah: "Agency fee plus performance-linked profit share, paid quarterly.",
  Mudarabah: "Profit-and-loss sharing per a pre-agreed ratio, distributed at each profit-recognition date.",
};

const REDEMPTION_TERMS_BY_TYPE: Record<RuleBasedStructureType, string> = {
  Murabahah: "Bullet repayment at maturity (cost plus the agreed markup).",
  Ijarah: "Principal returned at maturity via sale-and-leaseback unwind; rental income throughout the tenor.",
  Wakalah: "Capital returned at maturity net of agency fees; early redemption subject to Wakil approval.",
  Mudarabah: "Capital and accrued profit share returned at maturity; losses (if any) shared per the Mudarabah ratio.",
};

function profitMechanismFor(structureType: RuleBasedStructureType): string {
  return PROFIT_MECHANISM_BY_TYPE[structureType];
}

function redemptionTermsFor(structureType: RuleBasedStructureType): string {
  return REDEMPTION_TERMS_BY_TYPE[structureType];
}

function suggestedMinSubscription(targetSizeNGN: number): number {
  const raw = targetSizeNGN * 0.002;
  const roundedToHundredThousand = Math.round(raw / 100000) * 100000;
  return Math.min(Math.max(roundedToHundredThousand, 100000), 5000000);
}

export async function runProductStructuringAgent(context: DealContext): Promise<StructuringRecommendation> {
  const proposal = context.proposal as ProposalFields | null;

  if (!proposal || proposal.tenorMonths == null || proposal.targetSizeNGN == null) {
    return StructuringRecommendationSchema.parse({
      recommendedStructureType: "Wakalah",
      rationale: "No proposal data was supplied to structure against.",
      suggestedTerms: { tenorMonths: 12, profitMechanism: "N/A", minSubscriptionNGN: 0, redemptionTerms: "N/A" },
      openGaps: ["No proposal supplied"],
      confidence: "low",
    });
  }

  const description = proposal.description ?? "";
  const tenorMonths = nearestTenorBucket(proposal.tenorMonths);
  const recommendedStructureType = recommendStructureType(description, proposal.tenorMonths);
  const matchesProposed = proposal.proposedType === recommendedStructureType;

  const openGaps: string[] = [];
  if (description.length < 40) {
    openGaps.push("Proposal description is too brief for a term sheet — expand on use of proceeds and underlying assets.");
  }
  if (proposal.targetSizeNGN < 10_000_000) {
    openGaps.push("Target size is unusually small for an SEC-regulated note — confirm this isn't a typo.");
  }
  if (proposal.tenorMonths > 60) {
    openGaps.push("Tenor exceeds 5 years — confirm investor appetite and consider a shorter initial series.");
  }
  if (!matchesProposed) {
    openGaps.push(
      `Proposed structure type (${proposal.proposedType}) differs from the recommended type for this tenor/description — confirm with the Fund Manager before finalizing.`,
    );
  }

  const rationale = matchesProposed
    ? `${recommendedStructureType} fits the ${proposal.tenorMonths}-month tenor and description as proposed — no change recommended to the structure type.`
    : `Based on the ${proposal.tenorMonths}-month tenor${/\b(manage|managed|portfolio|agency|agent)\b/i.test(description) ? " and the managed/agency framing in the description" : ""}, ${recommendedStructureType} is a better fit than the proposed ${proposal.proposedType}.`;

  const output: StructuringRecommendation = {
    recommendedStructureType,
    rationale,
    suggestedTerms: {
      tenorMonths,
      profitMechanism: profitMechanismFor(recommendedStructureType),
      minSubscriptionNGN: suggestedMinSubscription(proposal.targetSizeNGN),
      redemptionTerms: redemptionTermsFor(recommendedStructureType),
    },
    openGaps,
    confidence: openGaps.length === 0 ? "high" : openGaps.length === 1 ? "medium" : "low",
  };
  return StructuringRecommendationSchema.parse(output);
}
