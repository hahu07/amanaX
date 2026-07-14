import { ledgerClient } from "./client.js";

export async function checkLedgerHealth(): Promise<{ reachable: boolean; offset?: number; error?: string }> {
  try {
    const { data, error } = await ledgerClient.GET("/v2/state/ledger-end");
    if (error || !data) {
      return { reachable: false, error: JSON.stringify(error) };
    }
    return { reachable: true, offset: data.offset };
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : String(err) };
  }
}
