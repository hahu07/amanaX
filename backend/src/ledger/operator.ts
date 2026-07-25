import { findOrAllocateParty } from "./commands.js";
import { config } from "../config.js";

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
  // OPERATOR_PARTY set means the party was allocated out-of-band (see
  // config.ts) — skip the ledger call entirely rather than hitting
  // `GET /v2/parties`, which a managed participant may 403 on for this
  // backend's ledger-api user even though it can act as the party once told
  // which one it is.
  if (config.operatorParty) {
    return Promise.resolve(config.operatorParty);
  }
  if (!operatorPartyPromise) {
    operatorPartyPromise = findOrAllocateParty("PlatformOperator").catch((err) => {
      operatorPartyPromise = null;
      throw err;
    });
  }
  return operatorPartyPromise;
}
