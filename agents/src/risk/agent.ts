import type { AllocationRiskContext, RiskAssessment } from "../types.js";
import { RiskAssessmentSchema } from "../types.js";

// docs/prompt.md's Risk Agent: "product risk assessment, operational risk
// review, concentration analysis." Same "deterministic, rule-based, not
// yet LLM-backed" reasoning as every other agent in this service.

const PRODUCT_RISK_TENOR_MONTHS_HIGH = 36;
const PRODUCT_RISK_TENOR_MONTHS_MEDIUM = 18;

// Murabahah's markup is fixed at inception (cost-plus, known return);
// Ijarah's return depends on the leased asset staying performant over the
// term; Wakalah and Mudarabah are both profit-sharing structures where
// the investor's return is genuinely variable — that ordering, not an
// arbitrary one, is what this tier reflects.
const STRUCTURE_BASE_RISK: Record<AllocationRiskContext["structureType"], "Low" | "Medium" | "High"> = {
  Murabahah: "Low",
  Ijarah: "Medium",
  Wakalah: "Medium",
  Mudarabah: "High",
};

function concentrationTier(pct: number): "Low" | "Medium" | "High" {
  if (pct > 25) return "High";
  if (pct >= 10) return "Medium";
  return "Low";
}

function productRiskTier(context: AllocationRiskContext): "Low" | "Medium" | "High" {
  const base = STRUCTURE_BASE_RISK[context.structureType];
  const tenorBump =
    context.tenorMonths >= PRODUCT_RISK_TENOR_MONTHS_HIGH ? 2 : context.tenorMonths >= PRODUCT_RISK_TENOR_MONTHS_MEDIUM ? 1 : 0;
  const order: Array<"Low" | "Medium" | "High"> = ["Low", "Medium", "High"];
  const bumped = Math.min(order.indexOf(base) + tenorBump, order.length - 1);
  return order[bumped];
}

function worse(a: "Low" | "Medium" | "High", b: "Low" | "Medium" | "High"): "Low" | "Medium" | "High" {
  const order: Array<"Low" | "Medium" | "High"> = ["Low", "Medium", "High"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

export async function runRiskAgent(context: AllocationRiskContext): Promise<RiskAssessment> {
  const concentrationPct = context.targetSizeNGN > 0 ? (context.requestedAmountNGN / context.targetSizeNGN) * 100 : 0;

  const operationalFlags: string[] = [];
  if (context.requestedAmountNGN < context.minSubscriptionNGN) {
    operationalFlags.push(
      `Requested amount (₦${context.requestedAmountNGN.toLocaleString()}) is below the structure's minimum subscription (₦${context.minSubscriptionNGN.toLocaleString()}).`,
    );
  }
  const projectedTotal = context.alreadyAllocatedNGN + context.requestedAmountNGN;
  if (projectedTotal > context.targetSizeNGN) {
    operationalFlags.push(
      `Allocating the full requested amount would bring total allocations to ₦${projectedTotal.toLocaleString()}, exceeding the offering's target size of ₦${context.targetSizeNGN.toLocaleString()}.`,
    );
  }

  const concTier = concentrationTier(concentrationPct);
  const prodTier = productRiskTier(context);
  let overallRisk = worse(concTier, prodTier);
  if (operationalFlags.length > 0) {
    overallRisk = worse(overallRisk, "Medium");
  }

  const notes =
    `This allocation represents ${concentrationPct.toFixed(1)}% of the offering (${concTier.toLowerCase()} concentration). ` +
    `The ${context.structureType} structure over ${context.tenorMonths} months carries ${prodTier.toLowerCase()} product risk. ` +
    (operationalFlags.length > 0
      ? "Operational flags were raised — review before allocating."
      : "No operational flags raised.");

  const output: RiskAssessment = {
    concentrationPct,
    concentrationTier: concTier,
    productRiskTier: prodTier,
    operationalFlags,
    overallRisk,
    notes,
  };
  return RiskAssessmentSchema.parse(output);
}
