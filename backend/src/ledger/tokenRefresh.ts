import { config } from "../config.js";

// Self-refreshing bearer token for a JWT-authenticated participant (DevNet/
// TestNet/production) — see config.ts's doc comment for why a single seeded
// refresh token is enough here, confirmed empirically against hackcanton-01.
// Local sandbox never calls this: client.ts's middleware only invokes it when
// an OIDC refresh token or static token is configured at all.

interface TokenState {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken: string;
}

let state: TokenState | null = null;
let inFlight: Promise<string> | null = null;

// Refresh this many seconds before actual expiry so a slow request never
// races a token that dies mid-flight.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

async function exchangeRefreshToken(refreshToken: string): Promise<TokenState> {
  const res = await fetch(config.ledgerOidcTokenUrl!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.ledgerOidcClientId!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`OIDC refresh_token exchange failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    // Keycloak may or may not rotate the refresh token on use; use whatever
    // it hands back, falling back to the one we just spent if it doesn't.
    refreshToken: body.refresh_token ?? refreshToken,
  };
}

export async function getManagedAccessToken(): Promise<string> {
  if (state && state.expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return state.accessToken;
  }
  // Multiple concurrent requests hitting an expired token shouldn't each fire
  // their own refresh call — share one in-flight exchange.
  if (!inFlight) {
    const seed = state?.refreshToken ?? config.ledgerOidcRefreshToken!;
    inFlight = exchangeRefreshToken(seed)
      .then((next) => {
        state = next;
        return next.accessToken;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
