# Deployment

Covers local development (what every prior milestone has run against), and the concrete checklist for promoting
past it — DevNet → TestNet → a production validator/NaaS host — per `docs/implementation_plan.md` §3.6 and
Milestone 9's "Deployment" line. No DevNet/TestNet credentials or NaaS account exist in this project's environment,
so the promotion path below is a verified-accurate runbook, not a "we did it" claim — see "What's not done yet" for
the honest gap list.

## Local development

Four processes, in order:

1. **`dpm sandbox`** — local Canton participant + JSON Ledger API, no auth.
   ```
   dpm sandbox --dar daml/main/.daml/dist/amanax-main-0.0.1.dar --json-api-port 7575
   ```
   Rebuild the DAR first if any `.daml` file changed: `cd daml/main && dpm build`. Confirm readiness with
   `curl http://localhost:7575/v2/state/ledger-end` — `{"offset":0}` on a fresh ledger.
2. **`agents/`** (port 4100): `cd agents && npm run dev`.
3. **`backend/`** (port 4000): `cd backend && npm run dev`. Confirm with `curl http://localhost:4000/health`.
4. **`frontend/`** (port 5173 by default): `cd frontend && npm run dev`.

Every `.env` var below is optional in this configuration — all of them have dev-safe defaults (see
`backend/.env.example`, `agents/.env.example`, `frontend/.env.example`).

## Environment variables

### `backend/`

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `LEDGER_API_URL` | `http://localhost:7575` | JSON Ledger API base URL |
| `DAML_PACKAGE_NAME` | `amanax-main` | `daml.yaml`'s `name` — used in `#name:Module:Entity` template references |
| `LEDGER_USER_ID` | `amanax-backend` | Fixed ledger-API user id (sandbox has no per-request user derivation) |
| `LEDGER_API_TOKEN` | unset | Static bearer token fallback — only used when no `LEDGER_OIDC_REFRESH_TOKEN` is set. Has to be refreshed by hand when it expires. |
| `LEDGER_OIDC_TOKEN_URL` / `LEDGER_OIDC_CLIENT_ID` / `LEDGER_OIDC_REFRESH_TOKEN` | unset | Preferred auth path for DevNet/TestNet/production — `ledger/tokenRefresh.ts` exchanges the refresh token for a fresh access token itself (`grant_type=refresh_token`) whenever the cached one is close to expiry, indefinitely, no human involved. Seed `LEDGER_OIDC_REFRESH_TOKEN` once via the participant's OIDC password grant (needs `offline_access` scope); everything after that is automatic. All three unset (local sandbox default) is a no-op — see `ledger/client.ts`'s middleware. |
| `JWT_SECRET` | dev-only fallback | **Must be set in production** — `config.ts` refuses to boot on the fallback when `NODE_ENV=production` |
| `OPERATOR_EMAIL` | `operator@amanax.dev` | The one dev-login email that resolves to the Platform Operator before any `User` contract exists |
| `AGENTS_SERVICE_URL` | `http://localhost:4100` | |
| `AGENTS_SHARED_SECRET` | unset | Sent as `X-Internal-Secret` to the agents service — see "Security hardening" below |
| `ALLOWED_ORIGIN` | unset (permissive) | CORS origin allowlist — **must be set** to the real frontend origin(s) outside local dev |

### `agents/`

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4100` | |
| `AGENTS_SHARED_SECRET` | unset | Must match the backend's value when set — see below |

### `frontend/`

| Var | Default | Notes |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:4000` | |

## Security hardening (Milestone 9)

Added this milestone, all backward-compatible with local dev (every one of them is a no-op when its env var is
unset):

- **`JWT_SECRET` boot guard** — `backend/src/config.ts` throws at startup if `NODE_ENV=production` and no
  `JWT_SECRET` was set, rather than silently signing tokens with a well-known dev secret.
- **JWT algorithm pinning** — `jwt.sign`/`jwt.verify` explicitly pin `HS256` rather than trusting the token's own
  `alg` header (defense against algorithm-confusion attacks).
- **CORS allowlist** — `ALLOWED_ORIGIN` restricts `cors()` to the real frontend origin; unset keeps the permissive
  dev default.
- **Rate limiting** — `POST /auth/login` and `POST /investor-signup` (the two genuinely unauthenticated write/probe
  surfaces) are limited to 20 requests/minute/IP via `express-rate-limit`. Disabled under `NODE_ENV=test` (the
  integration suite logs in dozens of times per file).
- **Agents-service shared secret** — the agents service has no auth of its own by design (only the backend calls
  it; see `docs/implementation_plan.md` §3.4). Setting `AGENTS_SHARED_SECRET` on both services adds a required
  `X-Internal-Secret` header as defense-in-depth for any deployment where network isolation alone isn't enough.
- **`express-async-errors` added to the agents service** — it already protected the backend since Milestone 6; the
  agents service was missing the same protection, meaning an agent throwing inside an async handler would have
  crashed the whole process instead of returning a 500. Fixed to match.
- **Structured logging** — see "Observability" below; every `500` response body includes a `requestId` that
  correlates to a structured log line, which matters operationally once this runs somewhere you can't just read the
  terminal.

Known, deliberately-not-fixed gap: **`/auth/login` has no password** — it's a documented placeholder for real OIDC
(`docs/implementation_plan.md` §2), not something buildable without an actual identity provider account (Keycloak/
Auth0) to integrate against, which this environment doesn't have. Rate limiting is the scoped Milestone 9
mitigation; the real fix is the OIDC swap-in described below.

## Observability

`backend/src/logging.ts` and `agents/src/logging.ts` (added this milestone) emit one JSON line per request/error to
stdout — `{ timestamp, level, message, ...fields }`. No logging-library dependency; a log aggregator (CloudWatch,
Loki, whatever the eventual NaaS host's story turns out to be) can parse structured JSON without a custom grok
pattern. Every request gets a `requestId` (also returned as the `X-Request-Id` response header), so a specific
failed request can be traced from a user report straight to its server-side log line and any downstream ledger/
agents-service errors it triggered.

**Metrics** — not instrumented. There is no metrics backend (Prometheus, Datadog, etc.) reachable from this dev
environment to scrape/push to, so adding a client library here would be untested code with nothing to verify it
against. What would matter once a real deployment exists:
- Per-route request rate, latency (p50/p95/p99), and error rate — the structured request logs above already carry
  everything needed to derive these from a log-based metrics pipeline, without adding a separate instrumentation
  library.
- Ledger command latency and failure rate, broken out by template/choice — the slowest, most failure-prone layer
  (network hop to the participant node).
- Agents-service invocation latency and Zod-validation-failure rate per report/agent kind — a spike here means a
  DealContext shape drifted from what an agent expects.
- `AuditLog` growth rate per `AuditEventKind` — a sudden change is a signal worth alerting on (e.g. compliance
  checks stopping is a workflow it's supposed to gate).

## Promoting past LocalNet

Per `docs/implementation_plan.md` §2's environment ladder: **LocalNet → DevNet → TestNet → production validator**.
Everything below Milestones 0-8 built and tested against LocalNet (`dpm sandbox`, no ledger-API auth). Promoting
requires the following concrete changes — none of which are made yet, since there's no DevNet/TestNet account in
this environment to make and verify them against:

1. **Ledger-API authentication.** ✅ Done, including unattended token refresh: `ledgerClient` (`ledger/client.ts`)
   attaches `Authorization: Bearer <token>` to every call via `openapi-fetch` middleware. When `LEDGER_OIDC_REFRESH_TOKEN`
   is set, `ledger/tokenRefresh.ts` exchanges it for a fresh access token itself (`grant_type=refresh_token`)
   whenever the cached one nears expiry — no human, no static token to expire mid-demo. The refresh token is seeded
   once, out-of-band, via a password-grant curl against the hackathon's Keycloak realm (needs `offline_access`
   scope); confirmed empirically against hackcanton-01 that this realm doesn't invalidate a refresh token after
   use, so a single seeded value keeps working indefinitely (the code also captures and uses whatever new
   `refresh_token` comes back, in case that ever changes). The one honest gap: this is still a refresh-token flow
   seeded from a human password grant, not a true `client_credentials` flow — because the OIDC client here
   (`web-app-ui-hackcanton-01-devnet`) isn't registered for that grant type. A non-hackathon deployment would want
   its own confidential client with `client_credentials` instead.
2. **Real OIDC for the backend's own JWT issuance.** `POST /auth/login` (no password) is fine for a LocalNet demo;
   production needs it replaced with real OIDC sign-in (Keycloak/Auth0 — see `docs/implementation_plan.md` §2).
   Because every downstream route already trusts a `AuthClaims` JWT identically regardless of how it was minted
   (`backend/src/auth/jwt.ts`), this is a swap at the `/auth/login` route only, not a rewrite of RBAC.
3. **Party allocation against the real participant.** `POST /v2/parties` works the same way against any
   participant node; no code change, but org onboarding needs to be re-run against the new network (parties don't
   carry over between networks).
4. **DAR upload.** `dpm sandbox --dar ...` uploads the DAR automatically on boot; DevNet/TestNet/production
   require an explicit DAR upload against the target participant (`dpm` supports this — consult the DPM docs
   current at promotion time, since this tooling moves fast, per `docs/implementation_plan.md` §2's own warning
   about stale training-data knowledge here).
5. **Secrets.** `JWT_SECRET`, `AGENTS_SHARED_SECRET`, and the OIDC client credentials from step 2 go through
   whatever secrets manager the hosting target provides — never committed, never logged (the structured logger in
   `backend/src/logging.ts` never logs full request bodies, only method/path/status/duration, so credentials
   passed in a body are never at risk of ending up in a log line).
6. **`ALLOWED_ORIGIN` / CORS.** Set to the real deployed frontend origin — see "Security hardening" above.
7. **Production hosting decision.** `docs/implementation_plan.md` §3.6 already decided: a Node-as-a-Service (NaaS)
   provider, not a self-hosted validator, to avoid the operational burden of running participant-node
   infrastructure. Provider selection was explicitly deferred to Milestone 9 and remains open — pick one, follow
   its participant-node onboarding (this dictates how step 1's OIDC provider and step 5's credential rotation
   actually work in practice), then re-verify steps 1-6 against it.

## What's not done yet

Being explicit rather than optimistic, per this project's own discipline of documenting real state over aspirational
state:

- ✅ A DevNet run has now happened: the full deal lifecycle (proposal → structuring → Shariah/Trustee review → SEC
  approval → Token Standard issuance → investor KYC/subscription/allocation → profit distribution) was driven live
  against `hackcanton-01`, a real shared Canton Network participant hosted by the AppsFactory hackathon's NaaS
  provider (noders.services) — not a provider we evaluated/selected ourselves for a real deployment, just the one
  this hackathon runs on.
- Ledger-API authentication now includes unattended refresh (see promotion step 1) — the remaining gap is that it's
  a refresh-token flow seeded from a one-time human password grant, not a true `client_credentials` flow, because
  the hackathon's OIDC client isn't registered for that grant type.
- `.github/workflows/ci.yml` runs `dpm build && dpm test` (DAML), backend integration tests, agents tests, and a
  frontend build on every push — but has not actually executed on a real GitHub Actions runner in this project
  (this environment has no GitHub remote to push to and trigger it). Milestone 9 found and fixed one concrete bug
  in it: the backend job ran `npm test` without ever starting `dpm sandbox` or the agents service, and every
  backend test is an integration test against both (see `docs/deployment.md`'s Local development section) — it
  would have failed outright. Fixed by adding the same DAR build + sandbox-start + agents-service-start steps the
  `daml` job and local dev already use, with a readiness poll before `npm test` runs. Not yet verified on a real
  runner, so treat it as "should work, reasoning matches what's proven to work locally" rather than "confirmed
  green in CI."
