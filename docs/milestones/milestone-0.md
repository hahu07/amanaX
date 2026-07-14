# Milestone 0 — Foundations

Status: **gate met.** All three sub-systems (DAML, backend, frontend) build, run, and pass their tests; the agents/ service (design from [docs/implementation_plan.md](../implementation_plan.md) §6) was also scaffolded and verified live, ahead of its Milestone 2-4 slot, since it was designed in this session before Milestone 0 build work started.

## Gate check (per docs/implementation_plan.md §4, Milestone 0)

| Requirement | Result |
|---|---|
| Empty DAML package builds (incl. Token Standard dependency) | ✅ `dpm build --all` succeeds; Token Standard interfaces resolve as data-dependencies (unused-dependency warning only, expected until Milestone 5-6) |
| Backend boots and reaches the ledger via the generated client | ✅ `GET /health` → `{"backend":"ok","ledger":{"reachable":true,"offset":10}}` against a live `dpm sandbox` |
| Frontend boots and reaches the backend | ✅ verified in a real browser via Claude Preview: renders `backend: ok`, `ledger reachable: true`, `ledger offset: 10` |

## What was built

### DAML (`daml/`)
- Restructured from the pre-existing single stray `daml.yaml` into the multi-package layout from the plan: `daml/multi-package.yaml`, `daml/main/` (production templates), `daml/test/` (Daml Script tests, depends on `main` via `data-dependencies`).
- `daml/main/daml/AmanaX/Foundation/Ping.daml` — a trivial `Ping`/`Pong` template, deliberately temporary, just to prove the toolchain end-to-end. **Delete this when the real `Identity` module (Organization/User) lands in Milestone 1.**
- `daml/test/daml/AmanaX/Foundation/PingTest.daml` — Daml Script exercising it (`dpm test`: 1 test, ok).

### Token Standard (CIP-0056) — vendored, not guessed
Per the decision in [implementation_plan.md](../implementation_plan.md) §5, the Token Standard is in scope for the MVP. Exact package coordinates weren't published anywhere as Maven/npm-style dependencies, so they were sourced directly from `github.com/canton-network/splice` (the repo `hyperledger-labs/splice` now redirects to) at tag `0.6.11` — chosen because the token-standard docs identify it as the **TestNet-aligned** bundle, matching this project's environment progression.

- Vendored into `vendor/token-standard/` (sibling of `daml/`, not nested under it — nesting it under `daml/` broke DPM's package discovery, see "Issues hit" below): `splice-api-token-metadata-v1`, `-holding-v1`, `-transfer-instruction-v1`, `-allocation-v1`, `-allocation-instruction-v1`, `-allocation-request-v1`. Provenance recorded in `vendor/token-standard/VENDORED.md` (source repo, commit, license Apache-2.0, update procedure).
- These packages pin `sdk-version: 3.5.2` upstream (not our choice) — which is why **this project's own SDK target moved from 3.4.11 to 3.5.2** (see "Decisions revisited" below). All packages, ours and vendored, now target Daml-LF `2.1`.
- Wired into `daml/main/daml.yaml` as `data-dependencies`. Not yet used by any template — that's Milestone 5 (`InvestmentNote` implements Token Metadata) and Milestone 6 (`Allocation` implements Holding + Allocation).

### Backend (`backend/`)
- Express + TypeScript, `npm run dev` via `tsx watch`.
- `src/ledger/client.ts` — the **only** ledger-access path, built on `openapi-fetch`, per the client-library decision in §5. No `@daml/ledger`/`@c7/ledger` dependency.
- `src/ledger/schema.d.ts` — **hand-maintained, not generated.** See "Issues hit" below for why; `npm run gen:ledger-client` is kept wired up (`openapi-typescript` against `/v2/openapi.json`) for whenever that route is resolved.
- `GET /health` round-trips `GET /v2/state/ledger-end`.
- Tests (`vitest` + `supertest`): pass both with and without a live ledger (graceful `503` on `ECONNREFUSED`, not a thrown error).

### Frontend (`frontend/`)
- Vite + React + TypeScript. Scaffolded via `npm create vite@latest -- --template react-ts`, then **downgraded from Vite 8 to Vite 6** — see "Issues hit."
- Shell page (`src/App.tsx`) calls the backend's `/health` and renders ledger status.
- Empty per-role dashboard folders created under `src/dashboards/` per the plan's §3.2 layout (operator, fundManager, issuingHouse, trustee, shariahAdvisor, custodian, distributor, investor, sec) — empty until Milestone 1.

### Agents (`agents/`)
- TypeScript + LangGraph.js, per the confirmed decision in §5.
- Implements the full design from implementation_plan.md §6: `IssuingHouseAssistantGraph` (supervisor, intent-routed) with three specialist stub nodes (`productStructuring`, `compliance`, `documentation`), Zod-validated I/O schemas matching §6.3 exactly, single internal endpoint `POST /internal/assistant/issuing-house/invoke` matching §6.4.
- Specialists are **deterministic stubs** (no LLM calls yet) — real model-backed logic is Milestone 2 (Product Structuring), 3-4 (Compliance), 4 (Documentation) per §6.6. The point of building this now was to prove the graph wiring, routing, and typed contract, not to ship real recommendations early.
- 4 tests (routing for all three intents + malformed-request rejection), all passing.
- No ledger client dependency anywhere in this package — structurally enforces the §6.5 guardrail.

### CI / repo (`.github/workflows/ci.yml`, `.gitignore`, git)
- Four CI jobs: `daml` (installs DPM + SDK 3.5.2, builds vendored Token Standard packages, builds `daml/`, runs `dpm test`), `backend`, `agents`, `frontend` (each `npm ci` + build + test).
- `.gitignore` broadened from the pre-existing root-only `/.daml /log` to cover build artifacts recursively across all four sub-projects (`.daml/`, `log/`, `node_modules/`, `dist/`, `.env*`).
- `git init` done, default branch renamed to `main`. **Not yet committed** — 87 files staged and ready; holding off on the first commit until you confirm (per the git safety default of not committing without an explicit ask).

## Decisions revisited from `docs/implementation_plan.md`
- **SDK version: 3.4.11 → 3.5.2.** The plan's §2 research (done before any real build) cited "Canton 3.4 / Splice 0.5.0" as current per the Canton MCP tool. Once vendoring the Token Standard required reading its actual `daml.yaml` from the live `canton-network/splice` repo, it turned out the real current source pins `sdk-version: 3.5.2`. Rather than fight version skew between our packages and the vendored ones, the whole project moved to 3.5.2 (latest non-rc stable available via `dpm version -A`). This doesn't contradict the plan — DPM guidance was "3.4+" — but is worth flagging since it's a live correction of a number written down before real build data existed.

## Issues hit and how they were resolved
1. **`dpm` component corruption from a racing background install.** An early `dpm install 3.5.2` was fired a second time (foreground) while a prior background install was still finishing; the two raced and left `daml-new`/`damlc` component directories present but empty. Fixed by deleting those two component dirs and reinstalling clean. Lesson for future sessions: don't re-issue a `dpm install` for a version that's already installing in the background — wait for the notification.
2. **Vendoring the Token Standard under `daml/vendor/...` broke DPM's package discovery.** DPM auto-walks up from a package directory looking for a `multi-package.yaml`; since `daml/multi-package.yaml` only lists `main` and `test`, any package nested under `daml/` but not listed there failed with `"DPM did not provide information for package..."`, even with `--enable-multi-package=no` (that flag is a `damlc`-level knob; the failure was at DPM's own resolution layer, above `damlc`). Fixed by moving `vendor/` to be a sibling of `daml/`, not nested under it.
3. **Upstream token-standard packages reference sibling DARs named `-current.dar`** (e.g. `splice-api-token-metadata-v1-current.dar`), which is produced by upstream's own Makefile/CI wrapper that we didn't vendor. Since `dpm build` alone produces `<name>-<version>.dar`, each build step copies the versioned DAR to a matching `-current.dar` alongside it so the vendored packages' own internal `data-dependencies` (left unmodified, on purpose, to keep the vendored source faithful) resolve correctly.
4. **`GET /v2/openapi.json` (and every other docs/swagger path tried) 404s on `dpm sandbox`**, despite the JSON API v2 jar containing server-side OpenAPI-generation code (`com.digitalasset.canton.http.json.v2.OpenAPI3_0_3Fix`, built on `sttp`/tapir apispec). The route appears gated behind configuration not exposed via `dpm sandbox`'s CLI flags. Rather than block Milestone 0 on this, `backend/src/ledger/schema.d.ts` is hand-maintained for the one endpoint currently used; the `gen:ledger-client` npm script is kept wired up for when this is resolved (worth revisiting with a full Canton config file instead of sandbox convenience flags — flagged as a Milestone 1 follow-up, not re-investigated further here).
5. **Vite 8 (pulled by `npm create vite@latest` today) failed to build** — `rolldown`'s native binding (`rolldown-binding.linux-x64-gnu.node`) wasn't installed as an optional dependency in this environment, and `@vitejs/plugin-react@6` requires Vite ^8 so it couldn't just be downgraded alone. Fixed by pinning `vite@^6.3.5` (mature, non-rolldown, esbuild/rollup-based) and `@vitejs/plugin-react@^4.3.4` together. Production build (`vite build`) now succeeds.
6. **Dev-dependency vulnerabilities** (`npm audit`: backend 5, agents 11 — both dominated by a `vite`/`esbuild` dev-server CORS advisory transitively pulled in by `vitest`). Not fixed: dev-only, local dev server, no production runtime exposure. Worth a `npm audit fix` pass before this ships, not before Milestone 0's gate.

## How to run this locally
```bash
export PATH="$HOME/.dpm/bin:$PATH"

# 1. Build the vendored Token Standard packages (one-time, or after updating vendor/)
for pkg in splice-api-token-metadata-v1 splice-api-token-holding-v1 \
           splice-api-token-transfer-instruction-v1 splice-api-token-allocation-v1 \
           splice-api-token-allocation-instruction-v1 splice-api-token-allocation-request-v1; do
  (cd "vendor/token-standard/$pkg" && dpm build)
done

# 2. Build AmanaX's own Daml packages
cd daml && dpm build --all --package-root main && cd ..

# 3. Start the sandbox with the main DAR loaded
cd daml/main && dpm sandbox --dar .daml/dist/amanax-main-0.0.1.dar --json-api-port 7575 &
cd ../..

# 4. Backend, agents, frontend (each in its own terminal)
npm --prefix backend run dev    # :4000
npm --prefix agents run dev     # :4100
npm --prefix frontend run dev   # :5173
```

## Next
Milestone 1 — Identity & Org model (`Organization`, `User` templates; party provisioning; JWT auth; RBAC middleware; login/dashboard shell routing). The `Ping` placeholder template gets deleted once `Identity` lands.
