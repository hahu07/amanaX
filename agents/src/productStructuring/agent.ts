import type { DealContext, StructuringRecommendation } from "../types.js";
import { StructuringRecommendationSchema } from "../types.js";

// Milestone 0 stub — deterministic placeholder so the supervisor graph and
// the backend contract (§6.4) are provably wired end-to-end. Replaced with
// a real LLM-backed recommendation in Milestone 2 (docs/implementation_plan.md §6.6).
export async function runProductStructuringAgent(context: DealContext): Promise<StructuringRecommendation> {
  const output: StructuringRecommendation = {
    recommendedStructureType: "Wakalah",
    rationale: "Milestone 0 placeholder — not yet backed by a model.",
    suggestedTerms: {
      tenorMonths: 12,
      profitMechanism: "TBD",
      minSubscriptionNGN: 0,
      redemptionTerms: "TBD",
    },
    openGaps: context.proposal ? [] : ["No proposal supplied"],
    confidence: "low",
  };
  return StructuringRecommendationSchema.parse(output);
}
