import { apiFetch } from "./backendClient";
import type { AuthState } from "../auth/types";

export async function login(email: string): Promise<AuthState> {
  return apiFetch<AuthState>("/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
