# AmanaX Implementation Plan

Status: **planning only — no code written yet.** Repo currently contains empty `agents/`, `backend/`, `daml/`, `frontend/` scaffolds, `daml.yaml`, and `docs/prompt.md` / `docs/overview_amanax.md`.

This document (a) reviews `prompt.md` for production-readiness gaps, (b) records the current Canton/DAML tooling facts this plan relies on (sourced live from the Canton MCP server, Canton 3.4 / Splice 0.5.0), and (c) lays out a milestone-by-milestone build plan from empty repo to a working MVP, so any future session can pick this up without re-deriving context.

---

## 1. Review of `docs/prompt.md`

The spec is a strong product brief but is not yet an engineering spec. It's internally consistent (roles, templates, workflow steps, and dashboards all line up) and gets the two most important architectural calls right:
- **DAML is the source of truth** — backend must never re-implement business rules.
- **AI agents are advisory-only** — never signatories, never authorize state transitions.

Gaps to close before/while building (tracked as open questions in §5, resolved provisionally in §3-§4 so work can start):

| Gap | Why it matters | Provisional resolution |
|---|---|---|
| No signatory/observer/controller map per template | This *is* the privacy and authorization model — can't be deferred to "implementation detail" | Drafted per-template in §4.2 |
| No party-provisioning model (party per org vs per user) | Determines RBAC design, party sprawl/cost, and how JWT claims map to `actAs`/`readAs` | Recommend **one Daml party per organization**, individual users handled by backend RBAC (see §3.3) |
| `ProductStructure` vs `InvestmentNote` relationship unspecified | Ambiguous whether these are one evolving contract or two linked contracts | Model as one lifecycle: `ProductProposal → ProductStructure → InvestmentNote` (see §4.2) |
| AI agent integration point undefined (LangGraph mentioned only in the persona line) | Need a service boundary so agents can't touch the ledger directly | `agents/` is a standalone service the backend calls over an internal API; agent output is persisted off-ledger and surfaced as non-authoritative UI content (see §3.4) |
| `AuditLog` template vs ledger's native transaction history | The ledger already gives immutable history per contract; a redundant `AuditLog` template needs a clear job | Use `AuditLog` only for **off-ledger events** (AI recommendations shown/dismissed, document generation, notification sends) that the ledger wouldn't otherwise capture; on-ledger state changes are audited via the transaction stream / PQS, not duplicated into `AuditLog` |
| No environment/deployment path from dev to production | "Production-ready" claim in the prompt needs a concrete path | LocalNet → DevNet → TestNet → validator-hosted production (see §3.6) |
| No currency/decimal/rounding convention | Needed for `ProfitDistribution`, `Allocation` math | Use Daml `Decimal` (10dp) throughout; display-format to NGN 2dp in frontend only |
| "Under five minutes" success criterion is ambiguous | Real SEC review isn't 5 minutes | Interpret as: the **automatable steps** (AI recommendations, all ledger commands, UI transitions) execute in <5 min in a demo/test run where human approvals are simulated back-to-back — not a claim about real regulatory turnaround |
| No CI/testing-environment split, no secrets/key management story | Needed for anything called "production-grade" | Added in §3.6 and §5 |

None of these block starting Milestone 0; they're resolved provisionally below and flagged in §5 for confirmation.

---

## 2. Canton/DAML platform facts (verified via Canton MCP, Canton 3.4 / Splice 0.5.0)

Verified live against `canton_lookup` / `canton_check` — do not use stale training-data knowledge for these; the tooling changed materially in Canton 3.4.

**Toolchain**
- Use **DPM** (Digital Asset Package Manager), not `daml-assistant`/legacy `daml` CLI (deprecated as of Canton 3.4 / Splice 0.5.0).
  - Install: `curl -sSL https://get.digitalasset.com/install/install.sh | sh` (JDK 17+ and VS Code required)
  - `dpm build` / `dpm build --all` (multi-package), `dpm test`, `dpm sandbox` (JSON API :7575, gRPC :6866), `dpm studio`, `dpm codegen-js` / `dpm codegen-alpha-typescript`
- `daml.yaml` keeps its current shape (`sdk-version`, `name`, `source`, `version`, `dependencies: [daml-prim, daml-stdlib, daml-script]`), supports `${ENV_VAR}` interpolation. Multi-package repos add a root `multi-package.yaml`.
- **Navigator is discontinued** — do not plan any UI around it; frontend talks to our own backend only (per prompt.md's own constraint, which happens to match current Canton guidance).
- Daml **Scenarios are fully superseded by Daml Script**; test via `dpm test`.

**Ledger API for the TypeScript backend**
- **JSON Ledger API (port 7575)** is the recommended integration point for a TS backend: `POST /v2/commands/submit-and-wait`, `POST /v2/state/active-contracts`, `GET /v2/state/ledger-end`, `POST /v2/parties` (confirmed live on Canton 3.5.6 — not `/v2/parties/allocate`; see docs/milestones/milestone-1.md), `GET /docs/openapi` (confirmed live on Canton 3.5.6 — not `/v2/openapi.json`; see docs/milestones/milestone-0.md). Generate a typed client from the served OpenAPI spec (e.g. `openapi-fetch`).
- gRPC Ledger API (port 6866) is better suited for the transaction/update stream (replaces the deprecated Daml Triggers pattern) — useful if the backend needs to react to ledger events rather than poll.
- `@daml/ledger` / `@daml/react` are **deprecated**; the flagged replacements are `@c7/ledger` / `@c7/react` (community-maintained). **Recommendation for this project:** don't take a dependency on a community package for a "production-grade" enterprise app without vetting it first — prefer a client generated from the served OpenAPI spec via `dpm codegen-js`/`codegen-alpha-typescript`, and only reach for `@c7/*` if the generated client proves insufficient. Flagged as an open decision in §5.

**Identity: parties and users**
- Party IDs (`hint::namespace_fingerprint`) can only be minted by a running participant node — not generated client-side. Allocate via `POST /v2/parties` (confirmed live on Canton 3.5.6 — not `/v2/parties/allocate`; see docs/milestones/milestone-1.md) (the old `daml ledger allocate-parties` is deprecated).
- Ledger API **users** are distinct from Daml **parties** — a JWT-authenticated user's `actAs`/`readAs` grants determine which parties it may act/read for. This is the mechanism our backend RBAC layer hooks into.
- Auth in production is JWT (RS256) via an OIDC provider (Keycloak/Auth0); local sandbox has no auth.
- External parties can hold their own signing keys (self-custody) — relevant if Investors should eventually sign their own subscriptions rather than delegate to the platform (flagged as future work, not MVP).

**Multi-party authorization**
- Standard idiom is **propose-accept**: Party A creates a proposal (A = signatory) → Party B exercises `Accept` (adds B's authority) → new contract with both as signatories. Standard choice triple: `Accept` / `Reject` / `Cancel`.
- `signatory` = required to create/archive; `observer` = guaranteed visibility, no authority; `controller` = who may exercise a specific choice. A sub-action's required authorizers must be a subset of the enclosing transaction's authorizers.
- Privacy is need-to-know by construction: parties see only transactions they're a stakeholder in, plus transitive consequences of what they can see. This maps directly onto prompt.md's per-role dashboards.
- **Contract keys are unavailable at the Daml-LF target this project builds on.** `key`/`maintainer` clauses need LF 2.3+; this project is pinned to `--target=2.1` (forced by the vendored Token Standard packages, see docs/milestones/milestone-0.md), so `dpm build` hard-errors on any template with a `key`. Confirmed empirically in Milestone 1 while building `Organization`/`User`. Lookup-by-field instead goes through an active-contract-set query (`POST /v2/state/active-contracts` with a per-party, per-template filter) — see `backend/src/ledger/commands.ts` `queryActiveContracts`. Every future template in this project needs to follow the same key-free pattern.

**Token Standard (CIP-0056)** — **confirmed in scope for this MVP** (see §5). Canton's ERC20-inspired standard for the UTXO/privacy model:
  - **Token Metadata** — name/symbol/totalSupply for the Investment Note instrument.
  - **Holding** — every investor's allocated units of the note are represented as a `Holding`-interface-implementing contract, giving a standard portfolio view instead of a bespoke `Allocation` record shape.
  - **Transfer Instruction (FOP)** — used for moving units between the platform and an investor's holding at issuance/allocation time.
  - **Allocation / Allocation Instruction / Allocation Request** — used for DVP-style atomic settlement between `Subscription` and `Holding` creation (subscription payment ↔ unit allocation as one atomic step), replacing an ad-hoc two-sided settlement.
  - All amounts as Daml `Decimal` (10dp); no unconstrained allowances (Allocation covers this).
  - The exact interface package/module names (`splice-token-standard-*`) and their pinned version need to be taken from `https://docs.canton.network/appdev/deep-dives/token-standard` and the `hyperledger-labs/splice` repo at implementation time — the MCP index confirms the API surface (Token Metadata / Holding / Transfer Instruction / Allocation / Allocation Instruction / Allocation Request) but not exact module paths, so pin the dependency during Milestone 0 setup rather than guessing it here.
  - Practical effect on the template list in §3.2: `InvestmentNote` implements `Token Metadata`; `Allocation` (prompt.md's template) is re-scoped to implement the CIP-0056 `Holding` + `Allocation` interfaces rather than being a bespoke record. Non-fungible/restricted-transfer semantics (this note isn't freely tradeable) are enforced via `Transfer Instruction` preconditions, not by avoiding the standard.
  - Ecosystem payoff: interoperates with any CIP-0056-aware wallet/custodian tooling, and Milestone 9's Node-as-a-Service hosting (§3.6) likely already speaks this standard, so building to it now avoids a rewrite for secondary-market/DVP settlement later.

**Testing**
- Unit tests: Daml Script (`dpm test`) — `allocateParty`, `submit`, `createCmd`, `exerciseCmd`, `submitMustFail`. Keep test scripts in a separate Daml package per `multi-package.yaml` best practice.
- Integration tests: run `dpm sandbox` locally, upload the DAR, drive it through the same JSON Ledger API client the backend uses (not a special test-only path) — this is what actually proves the backend/ledger contract.
- Multi-party integration (closer to production): CN Quickstart's LocalNet docker-compose (3 validators: `app-provider`, `app-user`, `sv`).

**Environments**
- **LocalNet** (CN Quickstart, docker-compose) — full local multi-participant network, dev/test only.
- **DevNet** — shared foundation-run network, resets periodically.
- **TestNet** — stable, non-resetting.
- **MainNet/production** — requires operating (or contracting) our own **Canton participant/validator node**; there is no shared public RPC endpoint model like Ethereum. Path: local → DevNet → TestNet → production validator (self-hosted via the Validator Docker Compose guide, or a Node-as-a-Service provider).

---

## 3. Architecture

### 3.1 Layers (per prompt.md, confirmed sound)
```
DAML Ledger (source of truth: state + business rules + authorization)
        ↑  JSON Ledger API (JWT-authenticated)
TypeScript Backend (REST API, orchestration, RBAC, AI orchestration, notifications, reporting)
        ↑  REST (JWT-authenticated)         ↑  internal API (no ledger access)
React Frontend                          agents/ service (LangGraph AI agents, advisory-only)
```
Hard rule carried from prompt.md and reinforced by the Canton authorization model: only the backend holds ledger credentials; the frontend and the agents service never see the Ledger API.

### 3.2 Repository layout
```
amanaX/
├── daml/
│   ├── daml.yaml
│   ├── multi-package.yaml
│   ├── main/                     # production templates package
│   │   └── daml/AmanaX/
│   │       ├── Identity/         # Organization, User
│   │       ├── Product/          # ProductProposal, ProductStructure, InvestmentNote
│   │       ├── Review/           # ShariahReview, TrusteeReview
│   │       ├── Regulatory/       # RegulatorySubmission, SECApproval
│   │       ├── Issuance/         # ProductIssuance
│   │       ├── Investor/         # InvestorProfile, Subscription, Allocation
│   │       ├── Distribution/     # ProfitDistribution
│   │       └── Reporting/        # ComplianceReport, AuditLog
│   └── test/                     # separate package: Daml Script tests
├── backend/
│   ├── src/
│   │   ├── api/                  # REST routes + OpenAPI spec
│   │   ├── auth/                 # JWT verification, RBAC middleware
│   │   ├── ledger/               # generated JSON Ledger API client + typed wrappers per template
│   │   ├── workflows/            # one orchestrator per workflow step (§4.1)
│   │   ├── agents-client/        # calls agents/ service, persists recommendations off-ledger
│   │   ├── reporting/
│   │   ├── notifications/
│   │   └── db/                   # off-ledger metadata: documents, AI recommendation log, notification log
│   └── test/                     # unit + integration (against dpm sandbox)
├── agents/
│   ├── src/
│   │   ├── graph/                # LangGraph orchestration
│   │   ├── productStructuring/
│   │   ├── compliance/
│   │   ├── documentation/
│   │   ├── risk/
│   │   └── reporting/
│   └── test/
├── frontend/
│   ├── src/
│   │   ├── dashboards/{operator,fundManager,issuingHouse,trustee,shariahAdvisor,custodian,distributor,investor,sec}/
│   │   ├── components/
│   │   ├── api/                  # backend REST client only
│   │   └── auth/
│   └── test/
├── infra/                        # docker-compose for LocalNet dev, CI pipeline config
└── docs/
    ├── prompt.md
    ├── overview_amanax.md
    ├── implementation_plan.md    # this file
    ├── architecture/             # diagrams, decision records — added per milestone
    └── api/                      # generated OpenAPI docs
```

### 3.3 Identity & RBAC model
- **Decided:** one **Daml party per organization** (Fund Manager firm, the Issuing House, the Trustee firm, etc.) plus one **regulator party** (SEC) and one **operator party** (Platform Operator). Individual human users authenticate via JWT/OIDC and are mapped backend-side to `(organization party, role)`; the backend sets `actAs`/`readAs` on ledger submissions accordingly.
  - Rationale: avoids party-per-human sprawl (parties have real operational cost on Canton) while still getting on-ledger, cryptographically-backed multi-party authorization at the organization level, which is the level prompt.md's roles are actually defined at.
  - **Investors:** **decided — platform-managed party for MVP** (the platform's validator node holds custody/signing on the investor's behalf, one party per investor account). Self-custody via Canton's external-party-onboarding pattern is a documented fast-follow, explicitly out of scope for Milestones 0-9.
- Backend RBAC middleware enforces role→endpoint permissions; DAML enforces role→ledger-action permissions independently. Neither layer trusts the other — this is the "backend never duplicates business rules, but does its own access control" split prompt.md calls for.

### 3.4 AI agent integration
- `agents/` is a separate service (LangGraph.js). Backend calls it over an internal API with a request that includes the relevant contract data (proposal terms, review checklist state, etc.).
- Agent responses are **never** submitted to the ledger directly. The backend persists them in its own DB (`agents-client`/`db`) tagged with the workflow step and contract id they relate to, and the frontend renders them as clearly-labeled "AI recommendation" panels next to the human action (Accept/Reject/etc.).
- This satisfies prompt.md's "AI outputs must be structured, validated, auditable, and treated as recommendations only" without needing a ledger template per recommendation.
- The Issuing House's three agents (Product Structuring, Compliance, Documentation) are unified into one assistant — full design in **§6**.

### 3.5 Per-template authorization sketch
Drafted so DAML work in Milestone 1+ isn't blocked on a design meeting — treat as a first draft to refine during implementation, not a final spec. `Org(role)` means the organization party carrying that role for the given deal.

| Template | Signatory | Controller(s) | Observer(s) |
|---|---|---|---|
| `Organization` / `User` | Platform Operator | Platform Operator | the org itself |
| `ProductProposal` | Fund Manager org | Fund Manager (create/withdraw) | Issuing House |
| `ProductStructure` | Fund Manager org, Issuing House org (propose-accept) | Issuing House (finalize) | Shariah Advisor, Trustee |
| `ShariahReview` | Shariah Advisor org, Issuing House org | Shariah Advisor (certify/reject) | Trustee, Fund Manager |
| `TrusteeReview` | Trustee org, Issuing House org | Trustee (approve/reject) | Fund Manager, SEC (readiness view only) |
| `RegulatorySubmission` | Issuing House org | Issuing House (submit) | SEC |
| `SECApproval` | SEC, Issuing House org | SEC (approve/reject) | Fund Manager, Trustee |
| `ProductIssuance` / `InvestmentNote` (implements Token Metadata) | Issuing House org | Issuing House (issue) | Fund Manager, Trustee, Custodian, Distributor, SEC |
| `InvestorProfile` | Investor party, Platform Operator (KYC attestation) | Platform Operator (approve KYC) | Distributor |
| `Subscription` | Investor party, Distributor org | Distributor (accept/reject) | Issuing House |
| `Allocation` (implements Holding + Allocation interfaces) | Issuing House org, Investor party | Issuing House (allocate), Investor (accept) | Custodian, Trustee |
| `ProfitDistribution` | Custodian org, Issuing House org | Custodian (execute) | Trustee, Investor (per holding) |
| `ComplianceReport` | Issuing House org | Issuing House, SEC (read) | SEC, Trustee |
| `AuditLog` | Platform Operator | Platform Operator (system-generated) | relevant org per logged event |

### 3.6 Environments & CI
- Local dev: `dpm sandbox` for fast template iteration; CN Quickstart LocalNet for multi-party integration testing before each milestone gate.
- CI: on every push — `dpm build --all` → `dpm test` (Daml) → backend unit tests → backend integration tests against an ephemeral `dpm sandbox` → frontend unit tests → (later) Playwright E2E against LocalNet.
- Progression: LocalNet (dev) → DevNet (shared integration testing) → TestNet (pre-prod, stable) → production. **Decided:** production hosting is a **Node-as-a-Service (NaaS) provider** rather than a self-hosted validator — removes the operational burden of running participant-node infrastructure, at the cost of a vendor dependency to select and integrate during Milestone 9 (candidate short-list to be evaluated then; not selected in this planning pass).
- Secrets/keys: JWT signing keys and any ledger-API admin credentials go through the standard secrets manager for wherever CI/hosting lands; never committed, never logged. The NaaS provider's onboarding will dictate how participant-node admin credentials are issued/rotated — capture that as a Milestone 9 doc once a provider is selected.

---

## 4. Milestone plan

Each milestone follows prompt.md's own gating rule: **do not start the next milestone until the current one compiles, runs, and passes its tests.** Each milestone below produces the five prompt.md deliverables (architecture note, folder structure delta, DAML model, backend/frontend implementation, tests) as a short doc under `docs/milestones/`.

### Milestone 0 — Foundations
- Install DPM; scaffold `daml/` (with `multi-package.yaml`), `backend/`, `frontend/`, `agents/` (TypeScript, LangGraph) skeletons.
- Pin the CIP-0056 Token Standard Daml dependency (exact package/module names pulled from `https://docs.canton.network/appdev/deep-dives/token-standard` and `hyperledger-labs/splice` — not guessed; see §2) into `daml.yaml`.
- Bring up `dpm sandbox` locally and CN Quickstart LocalNet for later multi-party testing.
- Backend: health endpoint that round-trips the JSON Ledger API (`GET /v2/state/ledger-end`); scaffold the **generated OpenAPI client** (`dpm codegen-js`/`codegen-alpha-typescript` or client generated from `/docs/openapi`) as the only ledger-access path — no `@daml/ledger`/`@c7/ledger` dependency.
- Frontend: shell app that calls the backend health endpoint.
- CI skeleton (build+test on push).
- **Gate:** empty DAML package builds (including the Token Standard dependency), backend boots and reaches the ledger via the generated client, frontend boots and reaches the backend.

### Milestone 1 — Identity & Org model
- DAML: `Organization`, `User` templates; party-per-org convention from §3.3.
- Backend: party/org provisioning endpoints, JWT verification, RBAC middleware, OpenAPI base spec.
- Frontend: login + role-based dashboard shell routing (empty dashboards per role).
- Tests: Daml Script for org/user creation and role-gated choices; backend auth integration tests.
- **Gate:** Platform Operator can onboard an organization and users for every role in prompt.md's list.

### Milestone 2 — Product proposal & structuring
- DAML: `ProductProposal` (Fund Manager signatory) → propose-accept → `ProductStructure` (Issuing House).
- Backend: workflow orchestration endpoints wrapping the ledger commands.
- Frontend: Fund Manager (propose) and Issuing House (review/structure) dashboards.
- AI: Product Structuring Agent wired end-to-end (recommend → display, per §3.4).
- **Gate:** a proposal can be created and structured, with AI recommendations visible to the Issuing House.

### Milestone 3 — Shariah & Trustee review
- DAML: `ShariahReview`, `TrusteeReview` — certification choices, observer visibility for downstream roles.
- Frontend: Shariah Advisor and Trustee dashboards.
- AI: Compliance Agent readiness checklist wired in.
- **Gate:** a structured product can be Shariah-certified and Trustee-reviewed on-ledger.

### Milestone 4 — Regulatory submission & SEC approval
- DAML: `RegulatorySubmission`, `SECApproval` — SEC as observer/controller per §4.2.
- AI: Documentation Agent generates the filing pack (off-ledger, attached as documents to the submission).
- Frontend: Issuing House submission flow, SEC dashboard.
- **Gate:** a reviewed product can be submitted and SEC-approved on-ledger.

### Milestone 5 — Issuance & Token Standard metadata
- DAML: `ProductIssuance`, finalizing `InvestmentNote` — **implements the CIP-0056 Token Metadata interface** (name/symbol/totalSupply for the note).
- Frontend: issuance confirmation views across all relevant roles.
- **Gate:** an approved product becomes a live, issued Investment Note discoverable via its Token Metadata.

### Milestone 6 — Investor onboarding, subscription, allocation (Token Standard Holding/Allocation)
- DAML: `InvestorProfile` (KYC, platform-managed party creation per §3.3), `Subscription`, `Allocation` — **`Allocation` implements the CIP-0056 `Holding` + `Allocation`/`Allocation Instruction` interfaces**, with `Transfer Instruction` moving units from issuer to investor holding; non-tradeable/restricted-transfer semantics enforced via `Transfer Instruction` preconditions rather than by not using the standard.
- Frontend: Investor onboarding/subscription flow, Distributor dashboard.
- AI: Risk Agent concentration/risk checks on allocation.
- **Gate:** an investor can onboard, subscribe, and be allocated a standard-compliant `Holding` of the issued note.

### Milestone 7 — Profit distribution
- DAML: `ProfitDistribution`, Custodian-executed with Trustee oversight. All amounts in **NGN**, Daml `Decimal` (10dp internally; display-formatted to 2dp in the frontend).
- Frontend: Custodian dashboard, Investor statements.
- **Gate:** a distribution can be calculated, approved, and recorded per investor `Holding`.

### Milestone 8 — Reporting & compliance
- DAML: `ComplianceReport`, `AuditLog` (off-ledger-event audit trail per §1).
- AI: Reporting Agent generates management/investor/compliance/regulatory reports.
- Frontend: reporting views per role.
- **Gate:** all four report types generate correctly from ledger + off-ledger data.

### Milestone 9 — Hardening & production readiness
- Security pass: JWT/RBAC/input validation/audit logging completeness review.
- Observability: structured logs, metrics, error handling audit.
- Full end-to-end timed run of all 15 workflow steps (validates the "<5 minutes" success criterion as scoped in §1).
- Deployment: promote through DevNet → TestNet; document the production validator setup.
- Finalize docs: architecture, API reference, deployment runbook.

---

## 5. Decisions log

All open questions from the previous revision of this plan are resolved as of 2026-07-13:

| Decision | Resolution | Where it lands in this plan |
|---|---|---|
| Ledger client library | Generated OpenAPI client (from `/docs/openapi` via `openapi-typescript`), not `@c7/ledger`/`@c7/react` | §2, §3.2 `backend/src/ledger/`, Milestone 0 |
| Agents service language | TypeScript (LangGraph.js) | §3.2 `agents/`, stack-consistent with backend/frontend |
| Party model | One Daml party per organization (+ SEC, + Platform Operator) | §3.3 |
| Investor custody | Platform-managed party for MVP; self-custody is an explicit fast-follow, out of scope for Milestones 0-9 | §3.3 |
| Token Standard (CIP-0056) | **In scope for the MVP**, not deferred — `InvestmentNote` implements Token Metadata, `Allocation` implements Holding + Allocation/Allocation Instruction, unit movement via Transfer Instruction | §2, §3.5 table, Milestones 5-6 |
| Production hosting | Node-as-a-Service (NaaS) provider, not self-hosted validator | §3.6, Milestone 9 |
| Currency | NGN only for MVP; Daml `Decimal` (10dp) internally, 2dp display formatting in frontend | §3.6, Milestone 7 |

No open questions remain that block starting Milestone 0. Provider selection for the NaaS host (§3.6) is deferred to Milestone 9 by design — it doesn't affect DAML/backend/frontend work in Milestones 0-8, which target LocalNet/DevNet/TestNet.

---

## 6. Issuing House AI Assistant — design spec

Design only — no code yet (per decision on 2026-07-13). This elaborates §3.4 for the one AI surface prompt.md gives a dedicated org-chart to: a single assistant for the Issuing House, composed of the three agents that carry it through structuring, review-readiness, and filing.

```
Issuing House
        │
        ├── AI Product Structuring Agent   (Milestone 2 — proposal → structure)
        ├── AI Compliance Agent            (Milestone 3-4 — review readiness, SEC-submission gate)
        └── AI Documentation Agent         (Milestone 4 — term sheet, filing pack)
```

### 6.1 Framing: one assistant, three specialists
The Issuing House dashboard exposes **one** assistant panel ("Structuring Assistant"), not three separate tools. Under the hood it's a LangGraph.js **supervisor graph** (`IssuingHouseAssistantGraph`) that routes each request to one or more of the three specialist subgraphs and merges their output. The user never has to know which agent answered, but every recommendation is attributed in its metadata (agent name, model, timestamp, input snapshot) — needed for the auditability prompt.md requires, and for the "AI recommendation" panels in §3.4.

Routing is intent-based, not free-form: the frontend/backend send an explicit `intent` alongside the `dealId` (see §6.4), so the supervisor's job is orchestration and context-sharing, not intent classification from prose. This keeps behavior deterministic and testable — important given AI output here feeds a regulated workflow.

### 6.2 Shared deal context (state passed between agents)
All three specialists read from one context object assembled by the backend for the deal in play, so the Compliance Agent's checklist and the Documentation Agent's term sheet stay consistent with what the Structuring Agent last recommended — this is the "share context" requirement:

```ts
interface DealContext {
  dealId: string;                  // == ProductProposal/ProductStructure contract id
  proposal: ProductProposalView;    // Fund Manager's original proposal (read-only)
  structure: ProductStructureView | null;   // current structure, if any
  shariahReview: ShariahReviewView | null;
  trusteeReview: TrusteeReviewView | null;
  checklist: ChecklistItemStatus[];         // running readiness checklist, agent- and human-updated
  documents: GeneratedDocumentRef[];        // artifacts the Documentation Agent has produced so far
  priorRecommendations: AgentRecommendation[]; // this deal's recommendation history, for continuity across sessions
}
```
The backend builds `DealContext` from ledger reads (via the generated JSON Ledger API client, §3.2) plus its own off-ledger AI-recommendation/document store — the agents service itself never queries the ledger (§3.4's hard rule holds).

### 6.3 Per-agent spec

**Product Structuring Agent**
- Trigger: Issuing House opens a proposal to structure it (workflow step 2-3), or re-requests advice after editing terms (step 4).
- Reads: `proposal`, `structure` (if mid-edit), general Islamic-finance structuring knowledge (Murabahah/Ijarah/Wakalah/Mudarabah note patterns) via prompt/system context — no external tool calls needed for this one.
- Structured output:
  ```ts
  interface StructuringRecommendation {
    recommendedStructureType: "Murabahah" | "Ijarah" | "Wakalah" | "Mudarabah" | "Hybrid";
    rationale: string;
    suggestedTerms: { tenorMonths: number; profitMechanism: string; minSubscriptionNGN: number; redemptionTerms: string };
    openGaps: string[];      // fields the proposal is missing that structuring needs
    confidence: "low" | "medium" | "high";
  }
  ```
- Never writes `structure` itself — Issuing House accepts/edits the recommendation, then the backend submits the actual `ProductStructure` create/accept command.

**Compliance Agent**
- Trigger: on-demand during review (steps 5-6), and **mandatorily** before the Issuing House can submit to SEC (step 7 in prompt.md is explicitly this agent's gate).
- Reads: `structure`, `shariahReview`, `trusteeReview`, `checklist`, `documents`.
- Tools (read-only, backend-mediated, not direct ledger access): `getChecklistTemplate(productType)` — returns the static regulatory/Shariah checklist for the instrument type (SEC Islamic-fund rules + Shariah checklist items), so the agent evaluates against a fixed rubric rather than inventing requirements each time.
- Structured output:
  ```ts
  interface ComplianceAssessment {
    readyForSubmission: boolean;        // hard gate the frontend disables "Submit to SEC" on when false
    missingDocuments: string[];
    shariahChecklistGaps: string[];
    workflowGaps: string[];             // e.g. "TrusteeReview not yet approved"
    blockingIssues: string[];           // must be empty for readyForSubmission = true
  }
  ```
- `readyForSubmission` is advisory in name only as far as the AI is concerned (the agent can be wrong), but the frontend treats it as a UX gate — the actual SEC-submission choice is still controller-gated on-ledger by `Issuing House` per §3.5, so a wrong AI assessment can't force an invalid on-ledger submission, only block/unblock a UI button.

**Documentation Agent**
- Trigger: after `ComplianceAssessment.readyForSubmission` trends true, or on-demand for interim drafts (approval packs for Shariah/Trustee review).
- Reads: `structure`, `shariahReview`, `trusteeReview`, `checklist`.
- Generates: term sheet, investment summary, approval pack (bundles prior review artifacts), SEC filing document draft — as Markdown content + structured metadata, not binary files, so it's diffable and human-editable before use.
- Structured output:
  ```ts
  interface GeneratedDocument {
    kind: "TermSheet" | "InvestmentSummary" | "ApprovalPack" | "RegulatoryFiling";
    title: string;
    markdown: string;
    sourceFacts: string[];   // which DealContext fields it drew from, for traceability
  }
  ```
- Stored in the backend's off-ledger document store (§3.2 `backend/src/db`), versioned per edit; only a human-approved version is attached to the on-ledger `RegulatorySubmission`.

### 6.4 Backend ↔ agents service contract
Single internal endpoint, intent-routed:
```
POST /internal/assistant/issuing-house/invoke
{ dealId: string, intent: "structure" | "assess-compliance" | "generate-documents", context: DealContext }
→ { agent: "product-structuring" | "compliance" | "documentation", output: <one of the three structured types above>, model, timestamp }
```
The backend, not the agents service, decides *when* to call this (tied to workflow-step transitions in `backend/src/workflows/`), and is solely responsible for persisting the result and exposing it to the frontend as a recommendation pending Accept/Edit/Dismiss (§3.4). The agents service is stateless per call — `priorRecommendations` in `DealContext` is how it gets continuity, not server-side session state, so it stays easy to test and horizontally scale.

### 6.5 Guardrails
- No agent, individually or via the supervisor, ever holds ledger credentials or calls the Ledger API — enforced structurally (agents service has no network path to the participant node, only to the backend's internal API, and that API is one-directional: backend calls agents, agents never call back into backend/ledger endpoints that mutate state).
- Every structured output is Zod-validated against the schemas in §6.3 before it's persisted or shown — malformed/unparseable model output is dropped and logged, never partially trusted.
- The frontend always labels these as AI-generated recommendations and requires an explicit human action before anything derived from them touches a ledger command — matches prompt.md's "AI must never make regulatory or investment decisions."
- Every recommendation is retained (not overwritten) in `priorRecommendations`/the document store for audit, regardless of whether the human accepted, edited, or dismissed it.

### 6.6 Milestone mapping
`agents/`'s skeleton (LangGraph.js app, empty supervisor + 3 stub subgraphs) is scaffolded in **Milestone 0** per §3.2. The Product Structuring Agent is fleshed out in **Milestone 2**, the Compliance Agent in **Milestone 3** (readiness checks during Shariah/Trustee review) and gated in **Milestone 4** (SEC-submission block), and the Documentation Agent in **Milestone 4** alongside regulatory submission. No new milestone is added — this design fits inside the existing plan in §4.

---

*Sources: `docs/prompt.md`, `docs/overview_amanax.md`, and live queries against the Canton MCP server (`canton_lookup`, `canton_check`, `canton_api_ref`, `canton_network_info`, `canton_get_started`) — Canton 3.4 / Splice 0.5.0, verified 2026-07-13. Revised 2026-07-13 to lock in the Token Standard, hosting, party, custody, currency, and client-library decisions in §5, and to add the Issuing House AI Assistant design in §6. Revised 2026-07-14 with corrections from actually building Milestones 0-1: real JSON Ledger API routes (`/docs/openapi`, `POST /v2/parties`) and the LF 2.1 contract-key limitation — see docs/milestones/milestone-0.md and milestone-1.md for the full detail.*
