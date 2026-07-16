import { describe, it, expect } from "vitest";
import { runRiskAgent } from "../src/risk/agent.js";
import type { AllocationRiskContext } from "../src/types.js";

function context(overrides: Partial<AllocationRiskContext>): AllocationRiskContext {
  return {
    structureType: "Murabahah",
    tenorMonths: 12,
    targetSizeNGN: 100_000_000,
    minSubscriptionNGN: 1_000_000,
    requestedAmountNGN: 5_000_000,
    alreadyAllocatedNGN: 0,
    ...overrides,
  };
}

describe("runRiskAgent", () => {
  it("rates a small Murabahah allocation as low concentration and low product risk", async () => {
    const result = await runRiskAgent(context({}));
    expect(result.concentrationPct).toBeCloseTo(5);
    expect(result.concentrationTier).toBe("Low");
    expect(result.productRiskTier).toBe("Low");
    expect(result.overallRisk).toBe("Low");
    expect(result.operationalFlags).toHaveLength(0);
  });

  it("rates a large allocation as high concentration", async () => {
    const result = await runRiskAgent(context({ requestedAmountNGN: 40_000_000 }));
    expect(result.concentrationTier).toBe("High");
    expect(result.overallRisk).toBe("High");
  });

  it("bumps product risk for a long-tenor Mudarabah structure", async () => {
    const result = await runRiskAgent(context({ structureType: "Mudarabah", tenorMonths: 48 }));
    expect(result.productRiskTier).toBe("High");
  });

  it("flags a request below the minimum subscription", async () => {
    const result = await runRiskAgent(context({ requestedAmountNGN: 500_000, minSubscriptionNGN: 1_000_000 }));
    expect(result.operationalFlags.some((f) => f.includes("below the structure's minimum subscription"))).toBe(true);
    expect(result.overallRisk).not.toBe("Low");
  });

  it("flags an allocation that would exceed the offering's target size", async () => {
    const result = await runRiskAgent(context({ alreadyAllocatedNGN: 98_000_000, requestedAmountNGN: 5_000_000 }));
    expect(result.operationalFlags.some((f) => f.includes("exceeding the offering's target size"))).toBe(true);
  });
});
