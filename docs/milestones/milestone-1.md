# Milestone 1 — Identity & Org Model

Status: **gate met.** Platform Operator can onboard an organization and a user for every org role, end to end: DAML templates → backend REST API with JWT auth and RBAC → React login and dashboards. Verified live in a browser, not just via automated tests.

## Gate check (per docs/implementation_plan.md §4, Milestone 1)

| Requirement | Result |
|---|---|
| DAML: `Organization`, `User` templates, party-per-org | ✅ built, plus a Daml Script test onboarding all 7 `OrgRole`s in one run |
| Backend: party/org provisioning endpoints, JWT auth, RBAC middleware | ✅ `/auth/login`, `/me`, `/orgs`, `/users`, all ledger writes going through a real `dpm sandbox` |
| Frontend: login + role-based dashboard shell routing | ✅ login page, 9 per-role dashboards, route guards |
| Tests: Daml Script + backend auth integration tests | ✅ 2 Daml Script tests, 6 backend integration tests (incl. an explicit backend-RBAC-not-just-frontend-guard test) |
| **Gate: Platform Operator can onboard an org + users for every role** | ✅ proven twice: once via `dpm test`, once live in a browser (operator onboards an Issuing House org + user through the actual UI, that user then logs in with their own email and lands on their own dashboard; a direct URL visit to `/dashboard/operator` while logged in as that user bounces back to `/login`) |

## What was built

### DAML (`daml/main/daml/AmanaX/Identity/`)
- `Organization.daml` — `OrgRole` (`FundManager | IssuingHouse | Trustee | ShariahAdvisor | Custodian | Distributor | SEC` — deliberately excludes `PlatformOperator`, which administers the network rather than being a member of it, and `Investor`, which is a platform-managed individual party per §3.3, not a firm, and gets its own template in Milestone 6). `Organization` is operator-signed, org-observed (matches the §3.5 authorization table exactly), with `Organization_Deactivate`/`Organization_Reactivate` choices that soft-toggle via a fresh contract rather than losing history.
- `User.daml` — same authorization shape, binds a named individual (`userId`, `email`, `displayName`) to an org party and role, for on-ledger audit purposes (§3.3: individual humans aren't separate Daml parties, but the ledger should still be able to prove which named person an org-signed action is attributed to).
- Neither template uses a Daml contract `key` — see "Findings" below.
- `daml/test/daml/AmanaX/Identity/OnboardingTest.daml` — `onboardsEveryOrgRoleTest` (7 orgs + 7 users, one per role) and `deactivateReactivateTest`. Both pass (`dpm test`).
- Milestone 0's `Ping`/`Pong` scaffold-proving template was deleted, as planned.

### Backend (`backend/src/`)
- `ledger/commands.ts` — the generic ledger command layer: `allocateParty` (always unique, short random suffix — see Findings), `findOrAllocateParty` (idempotent by hint, used only for the operator), `submitCreate`, `submitExercise`, `queryActiveContracts`. This is the layer every future milestone's ledger writes go through.
- `ledger/organizations.ts` — domain wrappers (`createOrganization`, `listOrganizations`, `setOrganizationActive`, `createUser`, `listUsers`, `findUserByEmail`, `setUserActive`) that type the raw JSON Ledger API responses into `Organization`/`OrgUser`.
- `ledger/operator.ts` — lazily resolves and caches the one Platform Operator party for the process lifetime, via `findOrAllocateParty` (not plain `allocateParty` — see Findings for why that distinction matters).
- `auth/` — `jwt.ts` (sign/verify), `middleware.ts` (`requireAuth`, `requireRole`), `types.ts` (`AuthClaims`).
- `api/auth.ts` — `POST /auth/login` (dev-login: email only, no password — a deliberate, documented placeholder for real OIDC later, see inline comment) and `GET /me`.
- `api/orgs.ts` — `POST /orgs`, `GET /orgs`, `PATCH /orgs/:contractId/active`, `POST /users`, `GET /users` — all behind `requireAuth` + `requireRole("PlatformOperator")`.
- Tests (`test/orgs.test.ts`): unauthenticated rejection, unknown-email login rejection, full onboarding round-trip (org → user → that user logging in and getting the right role/org claims), deactivate/reactivate, and an explicit test that a non-operator role gets `403` from the backend directly (not relying on the frontend to enforce it).

### Frontend (`frontend/src/`)
- `auth/` — `AuthContext.tsx` (React context backed by `localStorage`), `types.ts` (`Role`, `ROLE_ROUTE` role→URL-segment map).
- `api/authApi.ts`, `api/orgsApi.ts` — typed wrappers over the backend REST API (mirroring the backend's own domain types).
- `components/ProtectedRoute.tsx` — redirects to `/login` if unauthenticated or wrong role.
- `components/DashboardLayout.tsx` — shared header (role, org, sign-out) for every dashboard.
- `pages/LoginPage.tsx` — the dev-login form.
- `dashboards/operator/OperatorDashboard.tsx` — **real functionality**: onboard-organization form, organizations table with deactivate/reactivate, onboard-user form (org picker populated from live data), users table. This is what actually proves the milestone gate visually.
- `dashboards/{fundManager,issuingHouse,trustee,shariahAdvisor,custodian,distributor,sec,investor}/*Dashboard.tsx` — placeholders via a shared `RolePlaceholder` component, each labeled with the milestone that will fill it in (Investor has no login path yet — Milestone 6 — but the route is reachable for UI review).
- `App.tsx` — full router: `/login`, `/dashboard/operator`, `/dashboard/fund-manager`, etc., root redirect based on auth state.

## Findings

1. **Contract keys don't work at this project's Daml-LF target.** `key`/`maintainer` needs LF 2.3+; the vendored Token Standard packages (Milestone 0) pin `--target=2.1`, and `dpm build` hard-errors (`Contract Keys not supported on current lf version (2.1), feature supported in from 2.3`) the moment a template declares one. Both `Organization` and `User` were written key-free from the start once this was hit; lookups go through `queryActiveContracts` instead. Documented in `docs/implementation_plan.md` §"Multi-party authorization" as a rule for every future template in this project.

2. **The real party-allocation endpoint is `POST /v2/parties`, not `POST /v2/parties/allocate`.** The Milestone 0 planning research (sourced from the Canton MCP tool before any real API calls were made) had this wrong. Confirmed against the live, generated OpenAPI spec and by successfully calling it. `implementation_plan.md` §2 corrected.

3. **Party hints must be globally unique per participant, and this bites you fast in local dev.** `tsx watch` restarts the backend process (and its in-memory operator-party cache) on every file save, but doesn't restart the sandbox — so a naive "allocate a party called `PlatformOperator` on every boot" crashes on the second file save with `Party already exists`. Fixed with two allocation strategies in `ledger/commands.ts`: `allocateParty` (org/investor parties — always appends a short random suffix, so retries never collide) vs. `findOrAllocateParty` (the operator only — looks up an existing party by hint via `GET /v2/parties?filter-party=...` before allocating). Verified by running the backend test suite twice in a row without restarting the sandbox.

4. **Template IDs use the package-**name** reference format**, e.g. `#amanax-main:AmanaX.Identity.Organization:Organization` — not the package-id (hash) format, which the live spec itself flags as deprecated ("We plan to end support for this format in version 3.4"). This survives DAR rebuilds as long as the `daml.yaml` `name` doesn't change, unlike a hash-based reference.

5. **A stale Vite dependency pre-bundle cache caused a false "Invalid hook call" error** after adding `react-router-dom` mid-session (the dev server had already pre-bundled React before the new dependency was discovered, splitting module identity). Not a real bug — fixed by deleting `frontend/node_modules/.vite` and restarting the dev server. Worth knowing for future sessions: if a brand-new dependency's first render throws a hook error that makes no sense from the code, suspect the dep-optimization cache before the code.

## How to run this locally
Same as [milestone-0.md](milestone-0.md), plus:
```bash
# Backend needs these env vars in production; local dev defaults are fine as-is:
#   JWT_SECRET, OPERATOR_EMAIL (default operator@amanax.dev), LEDGER_USER_ID

# Log in as the operator (dev-login, no password):
curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"operator@amanax.dev"}'
```
In the browser: visit the frontend, sign in as `operator@amanax.dev`, onboard an organization and a user from the Operator dashboard, sign out, sign back in as the new user's email.

## Next
Milestone 2 — Product proposal & structuring (`ProductProposal`, `ProductStructure`; Fund Manager proposes, Issuing House structures; Product Structuring Agent wired in for real, replacing its Milestone 0 stub).
