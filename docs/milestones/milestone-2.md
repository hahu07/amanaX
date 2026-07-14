# Milestone 2 — Product Proposal & Structuring

Status: **gate met.** A Fund Manager can propose a product, an Issuing House can review it, get a real (rule-based) AI structuring recommendation, use it to pre-fill the structuring form, structure the proposal, edit terms, and finalize — all verified live in a browser against the real ledger, backend, and agents service, not just via automated tests.

## Gate check (per docs/implementation_plan.md §4, Milestone 2)

| Requirement | Result |
|---|---|
| DAML: `ProductProposal` (Fund Manager signatory) → propose-accept → `ProductStructure` (Issuing House) | ✅ built, with a full Draft → UpdateTerms → Finalize lifecycle plus Withdraw/Reject |
| Backend: workflow orchestration endpoints wrapping the ledger commands | ✅ `/proposals`, `/proposals/:id/{withdraw,reject,structure,structuring-recommendation}`, `/structures`, `/structures/:id`, `/structures/:id/finalize` |
| Frontend: Fund Manager (propose) and Issuing House (review/structure) dashboards | ✅ both replace their Milestone 1 placeholders with real functionality on the shared design system |
| AI: Product Structuring Agent wired end-to-end (recommend → display) | ✅ real rule-based engine (not the Milestone 0 stub), reachable from the Issuing House's proposal-review panel |
| **Gate: a proposal can be created and structured, with AI recommendations visible to the Issuing House** | ✅ proven twice: `dpm test` + 10 backend integration tests (incl. one against the live agents service), and live in a browser end to end (see "Verified live" below) |

## What was built

### DAML (`daml/main/daml/AmanaX/Product/`)
- `Types.daml` — `ProductType` (`Murabahah | Ijarah | Wakalah | Mudarabah`) and `ProductStructureStatus` (`ProductStructure_Draft | ProductStructure_Finalized`), shared by both templates.
- `ProductProposal.daml` — signatory Fund Manager, observer Issuing House. Choices: `ProductProposal_Withdraw` (Fund Manager), `ProductProposal_Reject` (Issuing House), `ProductProposal_Structure` (Issuing House, takes the initial structuring terms as choice arguments, creates a `ProductStructure`). Matches the standard propose-accept triple (Accept/Reject/Cancel → Structure/Reject/Withdraw) from `docs/implementation_plan.md` §2.
- `ProductStructure.daml` — signatories Fund Manager **and** Issuing House (propose-accept: both become signatories the moment it's created). Choices: `ProductStructure_UpdateTerms` (Issuing House, Draft-only, `assertMsg`-guarded), `ProductStructure_Finalize` (Issuing House, Draft-only). No Shariah Advisor / Trustee observers yet — Milestone 3 adds them when a Finalized structure is submitted for review (Daml needs archive+recreate to broaden observers, so that's the natural point, not here).
- `daml/test/daml/AmanaX/Product/ProductWorkflowTest.daml` — `proposeStructureFinalizeTest` (full lifecycle, including asserting a finalized structure rejects further `UpdateTerms` via `submitMustFail`) and `withdrawAndRejectTest` (withdraw, reject, and a Fund-Manager-can't-structure-their-own-proposal authorization check). Both pass.

### Backend (`backend/src/`)
- `ledger/products.ts` — domain wrappers mirroring `ledger/organizations.ts`'s pattern: `createProposal`, `listProposals`, `findProposalById`, `withdrawProposal`, `rejectProposal`, `structureProposal`, `listStructures`, `updateStructureTerms`, `finalizeStructure`.
- `ledger/commands.ts` — added `submitExerciseVoid`, for choices that return `()` (Withdraw/Reject) and therefore produce no `CreatedEvent` for the existing `submitExercise` to extract. Uses `/v2/commands/submit-and-wait` (whose request body is `JsCommands` directly — see Findings) rather than `/v2/commands/submit-and-wait-for-transaction`.
- `agents/client.ts` — the backend's HTTP client to the agents service (`docs/implementation_plan.md` §6.4). Builds `DealContext`, calls `POST /internal/assistant/issuing-house/invoke`, proxies the response straight back to the frontend. Recommendations aren't persisted (no `backend/src/db` exists yet) — a documented, deliberate simplification, not an oversight.
- `api/proposals.ts`, `api/structures.ts` — REST endpoints, RBAC-gated per the §3.5 authorization table (`FundManager` for propose/withdraw, `IssuingHouse` for reject/structure/update/finalize/recommendation; both for the read endpoints).
- `api/orgs.ts` — `GET /orgs` relaxed from Platform-Operator-only to any authenticated role, since cross-org workflows (a Fund Manager picking an Issuing House to propose to) need a directory of counterparties. Create/deactivate stay operator-only.
- `auth/middleware.ts` — added `requireOrgParty(req)`, a small helper that throws rather than silently submitting a ledger command with an empty `actAs`.
- `vitest.config.ts` — new: `fileParallelism: false`. See Findings.
- Tests (`test/products.test.ts`): full propose → structure → update → finalize round trip, Fund-Manager-can't-structure RBAC check, the AI recommendation endpoint (asserts a real recommendation with `confidence: "high"` for a proposal whose proposed type already matches what the rule-based engine would pick), and withdraw/reject.

### Agents (`agents/src/productStructuring/agent.ts`)
- Replaced the Milestone 0 stub with a real, deterministic, **rule-based** recommendation engine — not LLM-backed (no `ANTHROPIC_API_KEY` is configured in this environment; confirmed with the project owner, who chose "rule-based for now" over blocking the milestone on a key). Every rule is grounded in actual Islamic-finance structuring logic:
  - Structure type: keyword-detected agency/managed mandates → `Wakalah`; otherwise tenor-banded (`≤12mo → Murabahah`, `≤36mo → Ijarah`, `>36mo → Mudarabah`).
  - Suggested tenor: snapped to the nearest standard tenor bucket (3/6/12/18/24/36/48/60 months).
  - Suggested minimum subscription: 0.2% of target size, rounded to the nearest ₦100,000, clamped to [₦100,000, ₦5,000,000].
  - Profit mechanism / redemption terms: real, structure-type-specific language (e.g. Ijarah → periodic lease rental / sale-and-leaseback unwind; Murabahah → fixed cost-plus markup / bullet repayment).
  - `openGaps` and `confidence` are computed from real checks (description too short, target size unusually small, tenor exceeds 5 years, proposed type doesn't match the recommendation) — not placeholders.
  - Isolated entirely behind `runProductStructuringAgent(context)`: swapping in a real Claude call later touches only this file, not the graph, the API contract, or the frontend.
- `graph/issuingHouseAssistant.ts` — the `product-structuring` node's `model` label updated from `"stub-milestone-0"` to `"rule-based-v1"`.
- New test file `test/productStructuringAgent.test.ts` — 6 tests covering each tenor band, the Wakalah keyword override, the open-gaps/confidence computation, and the no-proposal fallback.

### Frontend (`frontend/src/`)
- `api/productsApi.ts`, `hooks/useProposals.ts`, `hooks/useStructures.ts` — same fetch-hook-owns-state pattern established in the production UI pass; `lib/format.ts` for NGN currency formatting.
- `dashboards/fundManager/FundManagerDashboard.tsx` — stat tiles (pending/in-structuring/finalized), a propose-a-product form (Issuing House picked from the live org directory), a proposals table (withdraw action), and a read-only structures table.
- `dashboards/issuingHouse/IssuingHouseDashboard.tsx` — stat tiles, a proposals table with a "Review" action that opens an inline panel: the AI recommendation (rationale, confidence badge, open gaps, a "Use recommended terms" button that pre-fills the form) directly above the structuring form itself (Structure / Reject). A separate structures table with an "Edit / finalize" action (update-terms form + a Finalize button), only shown for Draft structures.
- Both dashboards replace their Milestone 1 `RolePlaceholder` wrappers entirely.

## Findings

1. **The JSON Ledger API rejects Decimal *and* Int fields sent as raw JSON numbers.** `"Expected ujson.Str (data: 24)"` — both need `.toString()` in `createArguments`/`choiceArgument`, not just Decimal as Milestone 1 assumed. Documented inline in `ledger/products.ts` so the next template doesn't rediscover this.

2. **`POST /v2/commands/submit-and-wait`'s request body is `JsCommands` directly — not wrapped in a `{ commands: ... }` envelope**, unlike `submit-and-wait-for-transaction`, which uses a different wrapper type (`JsSubmitAndWaitForTransactionRequest`) that *does* nest `commands`. Caught immediately by the generated OpenAPI client's types (`Object literal may only specify known properties`) rather than at runtime — a concrete payoff of the Milestone 0 decision to generate the ledger client instead of trusting the plan's guessed shape.

3. **Daml choice syntax: the `with` argument block comes before `controller`, not after.** Both new choices (`ProductProposal_Structure`, `ProductStructure_UpdateTerms`) initially had `controller` first and hit a parser error (`parse error on input 'with'`). Fixed by reordering; worth remembering for every future parameterized choice in this project.

4. **Two test files sharing one live sandbox raced on the stable-hint `"PlatformOperator"` party allocation** once a second integration-test file (`products.test.ts`) existed — Vitest parallelizes across files by default, and two workers both called `findOrAllocateParty("PlatformOperator")` for the first time simultaneously, hitting `REQUEST_ALREADY_IN_FLIGHT`. Fixed with `vitest.config.ts`: `fileParallelism: false`. These are integration tests against one shared external resource, not unit tests — sequential is the correct default here, not a workaround.

5. **A cross-hook UI refresh bug, caught only by live browser verification, not by any automated test.** `useProposals` and `useStructures` are independent hooks with independent state; `proposals.structure()` refreshes the proposals list it owns, but has no way to know the *structures* hook needs refreshing too. The backend call succeeded (`201 Created`, confirmed via network log) but the new Draft structure didn't appear until a manual page reload. Fixed with an explicit `await structures.refresh()` in `IssuingHouseDashboard`'s `handleStructure`, re-verified live with a second full propose→structure cycle showing the structures table updating immediately. This is the kind of bug that automated integration tests (which drive the REST API directly, not the React state layer) structurally cannot catch — the reason this project's process insists on live browser verification, not just green test suites, before calling a milestone done.

6. **A stray `docs/implementation_plan.md` reversion surfaced again mid-milestone** (a working-tree edit reset the file to older content, same class of issue as during the production-UI-pass session) — caught by `git status`/`git diff` before staging, restored via `git checkout -- docs/implementation_plan.md` rather than committed. Not investigated further; if this recurs a third time it's worth root-causing rather than continuing to catch it at commit time.

## Verified live (not just automated tests)
Signed in as a Fund Manager, submitted a real proposal (₦500,000,000, 6-month tenor, Murabahah) to a live Issuing House org. Signed in as that Issuing House: saw the incoming proposal, clicked "Review," watched the AI Product Structuring Agent respond with "Recommends **Murabahah** — Murabahah fits the 6-month tenor and description as proposed — no change recommended to the structure type" at **high confidence**, clicked "Use recommended terms" (confirmed the form fields populated from the agent's actual suggested terms, not placeholders), submitted the structuring form, and confirmed the proposal moved out of the Proposals table and a Draft structure appeared. Edited the structure's terms, finalized it, confirmed the stat tiles and status badge updated correctly. Ran a second full cycle (a different product, Ijarah/24-month) to confirm the structures-list refresh bug (Finding 5) was actually fixed, not just true after a reload.

## How to run this locally
Same as [milestone-1.md](milestone-1.md) — all four services (`dpm sandbox`, `backend`, `agents`, `frontend`) need to be running. No new environment variables.

## Next
Milestone 3 — Shariah & Trustee review (`ShariahReview`, `TrusteeReview`; Issuing House submits a Finalized structure for review, broadening its observers to the relevant Shariah Advisor and Trustee orgs; Compliance Agent readiness checklist wired in).
