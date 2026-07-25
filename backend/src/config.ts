const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  ledgerApiUrl: process.env.LEDGER_API_URL ?? "http://localhost:7575",
  // Package name (daml.yaml `name`), not the content hash — the JSON Ledger
  // API's package-name reference format (`#name:Module:Entity`) survives
  // DAR rebuilds, unlike the deprecated package-id format.
  packageName: process.env.DAML_PACKAGE_NAME ?? "amanax-main",
  // Sandbox has no ledger-API auth, so there's no token to derive a user-id
  // from (see JsCommands.userId in the generated schema); everything this
  // backend submits uses one fixed ledger user-id.
  ledgerUserId: process.env.LEDGER_USER_ID ?? "amanax-backend",
  // DevNet/TestNet/production participants require a bearer token on every
  // Ledger API call (docs/deployment.md's promotion step 1); unset (the
  // local dpm sandbox default) means no Authorization header is sent at
  // all — see ledger/client.ts's middleware.
  //
  // Two ways to supply it, in priority order (see ledger/tokenRefresh.ts):
  //  1. LEDGER_OIDC_REFRESH_TOKEN set — the backend exchanges it for a fresh
  //     access token itself (grant_type=refresh_token) whenever the cached
  //     one is close to expiry, indefinitely, no human involved. Confirmed
  //     empirically against hackcanton-01's Keycloak realm: this realm does
  //     not invalidate a refresh token after use (no rotation enforcement),
  //     so a single seeded value keeps working across restarts — if that
  //     ever changes, the code below already captures and uses whatever
  //     `refresh_token` comes back on each exchange.
  //  2. LEDGER_API_TOKEN set (no refresh token) — used as a static bearer
  //     token, exactly as before; has to be refreshed by hand when it
  //     expires. Kept for local one-off testing without wiring up 1.
  ledgerApiToken: process.env.LEDGER_API_TOKEN,
  ledgerOidcTokenUrl: process.env.LEDGER_OIDC_TOKEN_URL,
  ledgerOidcClientId: process.env.LEDGER_OIDC_CLIENT_ID,
  ledgerOidcRefreshToken: process.env.LEDGER_OIDC_REFRESH_TOKEN,
  // Set when the Operator party was allocated out-of-band by the
  // participant operator rather than by this backend (see ledger/operator.ts)
  // — a managed DevNet may not grant this backend's ledger-api user rights to
  // list/allocate parties itself (`GET`/`POST /v2/parties` both 403), only to
  // act as parties it's been explicitly granted. Unset (local sandbox
  // default) preserves the original find-or-allocate-by-hint behavior.
  operatorParty: process.env.OPERATOR_PARTY,
  // `?? DEV_JWT_SECRET` alone only catches an unset var — dotenv turns a
  // blank `JWT_SECRET=` line (the exact form .env.example ships, "unset"
  // meaning "leave the value blank") into `""`, which is not nullish, so the
  // fallback silently never fired once `.env` loading was wired up. `|| ""`
  // first collapses both cases to the same falsy value.
  jwtSecret: process.env.JWT_SECRET || DEV_JWT_SECRET,
  // Bootstraps the one human operator allowed to log in before any User
  // contract exists — see backend/src/auth/devLogin.ts.
  operatorEmail: process.env.OPERATOR_EMAIL ?? "operator@amanax.dev",
  // The agents/ service (LangGraph.js) — see docs/implementation_plan.md
  // §6.4. Only the backend ever calls this; it never holds ledger
  // credentials and is never called directly by the frontend.
  agentsServiceUrl: process.env.AGENTS_SERVICE_URL ?? "http://localhost:4100",
  // Sent as X-Internal-Secret to the agents service when set — the agents
  // service has no ledger access and no auth of its own by design (§3.4:
  // it's reachable only from the backend), so this is defense-in-depth for
  // deployments where network-level isolation alone isn't enough. Unset in
  // local dev; both sides treat "unset" as "skip the check" (see
  // agents/src/index.ts's requireInternalSecret).
  agentsSharedSecret: process.env.AGENTS_SHARED_SECRET,
  // CORS origin allowlist. Unset (dev default) means the permissive
  // `cors()` default — reflects any Origin, fine for local dev where the
  // frontend's own origin isn't known ahead of time. Production must set
  // this to the real frontend origin(s); see docs/deployment.md.
  allowedOrigin: process.env.ALLOWED_ORIGIN,
};

// Fail fast rather than silently serving JWTs a well-known dev secret can
// forge. Milestone 9 hardening — see docs/milestones/milestone-9.md.
if (process.env.NODE_ENV === "production" && config.jwtSecret === DEV_JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production — refusing to start with the default dev secret.");
}
