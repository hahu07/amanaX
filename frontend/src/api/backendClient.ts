// The frontend only ever talks to the backend's REST API — never the Ledger
// API directly (docs/implementation_plan.md §3.1).
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

export interface HealthResponse {
  backend: "ok";
  ledger: { reachable: boolean; offset?: number; error?: string };
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BACKEND_URL}/health`);
  return res.json();
}
