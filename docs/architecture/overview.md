# AmanaX — System Architecture

A living reference, consolidated at Milestone 9 from `docs/implementation_plan.md` (the original design) and every
milestone doc's "What was built" section (what was actually shipped, including corrections along the way). Where
the two disagree, this doc follows what was actually built — see each row's "Milestone" column to trace the design
history.

## Layers

```
DAML Ledger (source of truth: state + business rules + authorization)
        ↑  JSON Ledger API (unauthenticated on LocalNet; JWT RS256 via OIDC beyond it — docs/deployment.md)
TypeScript Backend (REST API, RBAC, AI orchestration, audit logging)
        ↑  REST (JWT-authenticated)         ↑  internal API (no ledger access, optional shared-secret — docs/deployment.md)
React Frontend                          agents/ service (LangGraph.js AI agents, advisory-only)
```

Hard rule, unbroken across all 9 milestones: only the backend holds ledger credentials. The frontend and the
agents service never see the Ledger API. AI agent output is never submitted to the ledger directly — the backend
always requires an explicit human action (Accept/Reject/Approve/etc.) on a real ledger command before anything an
agent recommended actually changes state.

## Party model

One Daml party per **organization** (Fund Manager firm, Issuing House, Trustee firm, Shariah Advisor firm,
Custodian, Distributor), plus one **regulator party** (SEC) and one **operator party** (Platform Operator).
Individual human users authenticate via JWT and are mapped backend-side to `(organization party, role)`; the
backend sets `actAs` on ledger submissions accordingly (`backend/src/auth/middleware.ts`'s `requireOrgParty`).
**Investors** are the one exception: each gets their own platform-managed party (one party per investor account,
not shared across a firm) — self-custody is an explicit, documented fast-follow, out of scope through Milestone 9.

No Daml contract keys are used anywhere in this codebase — the project targets Daml-LF 2.1 (forced by the vendored
Token Standard packages), which doesn't support `key`/`maintainer` clauses. Every "must be unique" or "must exist"
check (unique symbol per Issuing House, one `InvestmentNote` per `SECApproval`, KYC-verified before subscribing,
etc.) is a query-before-mutate check in the backend, not a ledger-enforced constraint. This is a deliberate,
repeatedly-documented trade-off — see `docs/implementation_plan.md` §2 and the "query-before-mutate" comments
throughout `backend/src/ledger/*.ts`.

## Templates (final, as built)

| Template | Signatory | Observer | Milestone |
|---|---|---|---|
| `Organization` | operator | party (itself) | 1 |
| `User` | operator | org | 1 |
| `ProductProposal` | sponsor | issuingHouse | 2-3 |
| `ProductStructure` | sponsor, issuingHouse | — | 2-3 |
| `ShariahReviewRequest` → `ShariahReview` | issuingHouse → issuingHouse, shariahAdvisor | shariahAdvisor, sponsor → sponsor | 3 |
| `TrusteeReviewRequest` → `TrusteeReview` | issuingHouse → issuingHouse, trustee | trustee, sponsor → sponsor | 3 |
| `RegulatorySubmission` | issuingHouse | sec, sponsor, trustee | 4 |
| `SECApproval` | issuingHouse, sec | sponsor, trustee | 4 |
| `InvestmentNote` (Token Standard `InstrumentId`/`Metadata`) | issuingHouse | sec, sponsor, trustee, operator | 5 |
| `InvestorProfile` | operator | investor, distributor | 6 |
| `SubscriptionRequest` | investor | distributor, issuingHouse, sponsor | 6 |
| `Allocation` (implements Token Standard `Holding`) | distributor | investor, issuingHouse, sponsor | 6 |
| `DistributionRequest` | custodian | trustee, issuingHouse, sponsor | 7 |
| `ProfitDistribution` (one per investor share) | custodian, trustee | investor, issuingHouse, sponsor | 7 |
| `ComplianceReport` | issuingHouse | trustee, sponsor | 8 |
| `AuditLog` | operator | actor | 8 |

Two corrections worth calling out explicitly, since they diverge from `docs/implementation_plan.md`'s original
draft table (§3.5) and are easy to trip over if you go looking there first:
- **`ComplianceReport` has no `sec` field or observer.** It's generated at the Trustee-review stage — before SEC is
  even chosen (that happens at submission time, Milestone 4) — so there's nothing to name yet. See
  [milestone-8.md](../milestones/milestone-8.md) Findings #1.
- **`Allocation` implements only the Token Standard `Holding` interface, not `Allocation`/`AllocationInstruction`.**
  Those CIP-0056 interfaces model a temporary reservation for one leg of a cross-app atomic settlement — a
  different concept from "units allocated to an investor in this single-registry issuance." See
  [milestone-6.md](../milestones/milestone-6.md) Findings #1.

## Privacy pattern: one contract per stakeholder-with-different-visibility

The recurring design rule, first learned the hard way in Milestone 7 (see its Findings #1): Daml has no
field-level redaction — an observer sees a contract's entire data or none of it. Whenever a single logical event
needs to notify multiple counterparties with data that must **not** be cross-visible (per-investor payout amounts
being the clearest example), the fix is one contract *per recipient*, not one shared contract with an embedded
list. `ProfitDistribution` is the concrete instance: `DistributionRequest_Approve` creates N separate
`ProfitDistribution` contracts (one per investor share) in a single transaction via `forA`, not one contract
holding the whole cap table.

## AI agents

`agents/` is a standalone LangGraph.js service. Four kinds of advisory output, none ever touching the ledger:

| Agent | Trigger | Output |
|---|---|---|
| Product Structuring | Issuing House opens a proposal to structure it | Recommended structure type, terms, rationale |
| Compliance | On-demand during review; mandatory gate before SEC submission | `readyForSubmission` + gap lists — a real gate on the "Submit to SEC" UI action, backed by a server-side recheck at submit time (not just trusted from an earlier preview) |
| Risk | Distributor allocating a subscription | Concentration/operational risk notes — advisory only, oversubscription itself is a real server-enforced block, not an AI judgment call |
| Reporting | 4 different personas, 4 different report kinds | Management / investor / compliance / regulatory markdown reports |

The first three are unified behind one supervisor graph (`IssuingHouseAssistantGraph`, intent-routed:
`structure` / `assess-compliance` / `generate-documents`) exposed as a single Issuing-House-facing endpoint, per
`docs/implementation_plan.md` §6. The Risk Agent and Reporting Agent are separate, dedicated
`/internal/risk/assess` and `/internal/reports/generate` routes rather than graph nodes, because they're invoked
by personas and workflow steps outside the graph's Issuing-House-only scope (Milestones 6 and 8 respectively).

All four are **rule-based** (deterministic, no LLM backing) — there's no `ANTHROPIC_API_KEY` configured in this
project's environment, so every agent is implemented as explicit logic over its structured input rather than a
model call. The Zod-validated request/response contracts at the service boundary (`agents/src/types.ts`) are what
actually matter architecturally; swapping the rule-based implementation for an LLM-backed one later is a
same-shape internal change, not a contract change.

## Audit trail

Two distinct mechanisms, deliberately not merged (`docs/implementation_plan.md` §1):
- **On-ledger state changes** (every proposal, review, approval, allocation, distribution) are audited via the
  ledger's own transaction stream — Canton already gives immutable, cryptographically-backed history per contract.
  Duplicating that into an application-level log would be redundant and could drift from the source of truth.
- **`AuditLog`** (Milestone 8) covers exactly the off-ledger events the ledger wouldn't otherwise capture: AI
  agent invocations (`StructuringRecommendationShown`, `ComplianceCheckPerformed`, `DocumentGenerated`,
  `RiskAssessmentPerformed`, `ReportGenerated`). Scoped per-party automatically by its own `signatory operator,
  observer actor` shape — the Platform Operator sees every entry, everyone else sees only their own.

## Security & observability (Milestone 9)

See [deployment.md](../deployment.md) for the full detail — summarized here for completeness:
- JWT: pinned `HS256`, production boot guard against the dev-only default secret.
- RBAC: every mutating route requires a specific role via `requireRole`; every router requires authentication via
  `requireAuth`; verified complete by direct audit of all ~50 routes in `backend/src/api/*.ts` (see
  [milestone-9.md](../milestones/milestone-9.md)).
- Rate limiting on the two genuinely unauthenticated write routes (`/auth/login`, `/investor-signup`).
  agents-service shared-secret (`AGENTS_SHARED_SECRET`) as defense-in-depth alongside network isolation.
- Structured JSON request/error logging with per-request correlation IDs in both the backend and agents service.
- CI (`.github/workflows/ci.yml`) runs `dpm build && dpm test`, backend integration tests against a real ephemeral
  `dpm sandbox` + agents service, agents unit tests, and a frontend build, on every push.

## Where to go next

- [docs/api/README.md](../api/README.md) — full REST route reference.
- [docs/deployment.md](../deployment.md) — local dev, environment variables, and the DevNet/TestNet/production
  promotion checklist.
- `docs/milestones/milestone-{0..9}.md` — the build history, including every design correction made along the way
  and why.
