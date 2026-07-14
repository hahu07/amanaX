import { findOrAllocateParty } from "./commands.js";

// The Platform Operator is the sole signatory on Organization/User (§3.5 of
// docs/implementation_plan.md) and isn't itself an Organization record — it's
// the network administrator. `findOrAllocateParty` gives this a stable hint
// ("PlatformOperator") that survives backend restarts against the same
// still-running sandbox — important because `tsx watch` restarts this
// process (and its in-memory cache) on every file save, but not the
// sandbox. A real deployment would persist the allocated party id instead
// of re-deriving it by hint on every boot.
let operatorPartyPromise: Promise<string> | null = null;

export function getOperatorParty(): Promise<string> {
  if (!operatorPartyPromise) {
    operatorPartyPromise = findOrAllocateParty("PlatformOperator").catch((err) => {
      operatorPartyPromise = null;
      throw err;
    });
  }
  return operatorPartyPromise;
}
