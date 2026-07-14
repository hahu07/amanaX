// The frontend only ever talks to the backend's REST API — never the Ledger
// API directly (docs/implementation_plan.md §3.1).
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

export interface HealthResponse {
  backend: "ok";
  ledger: { reachable: boolean; offset?: number; error?: string };
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BACKEND_URL}/health`);
  return res.json();
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
