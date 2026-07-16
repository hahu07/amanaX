# Milestone 8 — Reporting & Compliance

Status: **gate met.** All four report types (management, investor, compliance, regulatory) generate correctly from live ledger data plus off-ledger context, each scoped to the requesting role's own visibility — verified live in a browser across four role logins (Issuing House, Investor, SEC, Trustee), with a cross-check of the platform-wide `AuditLog` confirming every AI-agent invocation across the session is captured and correctly bucketed by event kind.

## Gate check (per docs/implementation_plan.md §4, Milestone 8)

| Requirement | Result |
|---|---|
| DAML: `ComplianceReport` | ✅ built — signatory Issuing House, observer Trustee/Sponsor; see Findings #1 for why it carries a bare `dealId : Text` rather than a Token Standard `InstrumentId` |
| DAML: `AuditLog` (off-ledger-event audit trail per §1) | ✅ built — signatory operator, observer actor, `AuditEventKind` enum of 5 values; wired into every existing agent-invoking route |
| AI: Reporting Agent generates management/investor/compliance/regulatory reports | ✅ rule-based (matching every other agent in this codebase), one `runReportingAgent(context)` dispatching to 4 report-kind builders |
| Frontend: reporting views per role | ✅ Issuing House (management + compliance), Investor (investor report), SEC (regulatory), Trustee (read-only compliance-report list) |
| **Gate: all four report types generate correctly from ledger + off-ledger data** | ✅ proven three times: `dpm test` (3 new tests), 5 new backend integration tests + 5 new agents unit tests, and a full live walkthrough across 4 role logins — including catching and fixing a real bug that only surfaced in the browser (see Findings #3) |

## What was built

### DAML
- **`AmanaX/Compliance/ComplianceReport.daml`** (new) — `ComplianceReport` (signatory `issuingHouse`, observer `trustee`/`sponsor`): `dealId`, `productName`, `readyForSubmission`, `workflowGaps`, `shariahChecklistGaps`, `missingDocuments`, `generatedAt`. A durable, persisted snapshot of a Compliance Agent assessment taken at the Trustee-review stage — see Findings #1 for why its field shape was corrected before the backend layer was finished.
- **`AmanaX/Audit/AuditLog.daml`** (new) — `AuditEventKind` (`StructuringRecommendationShown`, `ComplianceCheckPerformed`, `DocumentGenerated`, `RiskAssessmentPerformed`, `ReportGenerated`); `AuditLog` (signatory `operator`, observer `actor`, `ensure agent /= "" && summary /= ""`): `agent`, `summary`, `dealId`, `occurredAt`. Scoped deliberately to *off-ledger* AI-agent activity only — the ledger's own transaction stream already gives immutable history for every on-ledger state change, so `AuditLog` doesn't duplicate it (a design decision recorded in `docs/implementation_plan.md` §1 since early in the project, only implemented this milestone).
- **`daml/test/daml/AmanaX/Compliance/ComplianceReportTest.daml`** — `complianceReportTest`, `onlyStakeholdersCanSeeReportTest`.
- **`daml/test/daml/AmanaX/Audit/AuditLogTest.daml`** — `auditLogTest`.
- All 21 DAML tests pass (`dpm test`), including these 3 new.

### Agents
- **`agents/src/types.ts`** — `ReportTypeSchema` (`management`/`investor`/`compliance`/`regulatory`), `ReportContextSchema` (one flexible shape covering all 4 kinds: `reportType`, `dealId`, optional `generatedFor`/`productName`/`symbol`/`structureType`/`targetSizeNGN`/`totalSupply`/`approvalReference`/`certificationNotes`/`approvalNotes`/`compliance`, `holdings`/`distributions` defaulting to `[]`), `GeneratedReportSchema` (`reportType`, `title`, `markdown`, `sourceFacts`).
- **`agents/src/reporting/agent.ts`** (new) — `runReportingAgent(context)` dispatches to 4 helper functions (`managementReport`/`investorReport`/`complianceReport`/`regulatoryReport`), each building grounded markdown with a `sourceFacts` traceability array, mirroring the Documentation Agent's established style (`formatNGN`, graceful "TBD"/fallback handling for missing fields).
- **`agents/src/index.ts`** — new `POST /internal/reports/generate` route, a dedicated non-graph endpoint (like the Risk Agent's `/internal/risk/assess`) rather than a LangGraph.js supervisor node, because it's invoked by 4 different personas at different workflow steps, not the Issuing-House-only scope the graph covers.
- **`agents/test/reportingAgent.test.ts`** (new) — 5 tests: management report grounded facts, investor report with a multi-note portfolio, compliance report in a not-ready state, regulatory report with certification/approval history, graceful empty-context fallback. All 30 agents tests pass (5 new).

### Backend
- **`ledger/auditLog.ts`** (new) — `logAuditEvent(params: {actor, kind, agent, summary, dealId})` (resolves the operator party internally, so callers only pass the actor) and `listAuditLog(party)`, sorted newest-first.
- **`ledger/complianceReports.ts`** (new) — `createComplianceReport`, `listComplianceReports`, matching `ComplianceReport.daml`'s corrected field shape.
- **`api/reports.ts`** (new, [reports.ts](../../backend/src/api/reports.ts)) — 6 routes:
  - `GET /investment-notes/:contractId/reports/management` (IssuingHouse) — own subscriptions/distributions for the note, filtered by `instrumentMatches`.
  - `GET /reports/investor` (Investor) — own Allocated holdings + own distributions, `generatedFor` set from the JWT's `displayName`.
  - `POST /trustee-reviews/:contractId/compliance-report` (IssuingHouse) — re-runs the Compliance Agent, persists the result as a `ComplianceReport`, logs `ComplianceCheckPerformed`, and also generates a markdown compliance document via the Reporting Agent.
  - `GET /compliance-reports` (IssuingHouse, Trustee, FundManager, Issuer).
  - `GET /investment-notes/:contractId/reports/regulatory` (SEC, IssuingHouse) — fetches the note's `SECApproval` for certification/approval notes; distributions are naturally scoped to whatever the caller can see (see Findings #4).
  - `GET /audit-log` (any authenticated role) — `PlatformOperator` reads via `getOperatorParty()` (sees everything); every other role reads via their own org party, scoped automatically by `AuditLog`'s `signatory operator, observer actor` shape.
- **Audit logging wired into 5 existing agent-invoking routes** — each gained a `logAuditEvent` call immediately after its agent invocation: `api/proposals.ts` (`StructuringRecommendationShown`), `api/reviews.ts` (`ComplianceCheckPerformed`), `api/regulatory.ts` (`DocumentGenerated` for the filing-pack preview, `ComplianceCheckPerformed` for the submit-to-SEC recheck — logged unconditionally, even when the recheck blocks submission), `api/subscriptions.ts` (`RiskAssessmentPerformed`).
- **`backend/test/reports.test.ts`** (new) — 5 tests: management report reflects real subscriptions/distributions, investor report scoped to own portfolio, compliance report persisted and visible to Issuing House + Trustee, regulatory report for SEC with RBAC rejection for Trustee, `AuditLog` entries recorded and correctly scoped per party. All 36 backend tests pass (5 new).

### Frontend
- **`api/reportsApi.ts`**, **`hooks/useComplianceReports.ts`** (new) — the established typed-client / fetch-hook pattern.
- **`dashboards/issuingHouse/IssuingHouseDashboard.tsx`** — "Generate compliance report" button + document panel inside the existing compliance panel; a "Report" action column on the Investment Notes table opening a management-report panel; a new read-only "Compliance reports" card listing every persisted report.
- **`dashboards/sec/SecDashboard.tsx`** — "Report" action column on the Issued notes table opening a regulatory-report panel.
- **`dashboards/investor/InvestorDashboard.tsx`** (+ `.module.css`, which gained `.documentsList`/`.documentItem`/`.documentMarkdown`) — new "Investor report" card with a header-action button toggling a markdown panel.
- **`dashboards/trustee/TrusteeDashboard.tsx`** — new read-only "Compliance reports" card.
- `npx tsc -b` and `npx vite build` both clean.

## Findings

1. **`ComplianceReport`'s first field shape coupled it to concepts that don't exist yet at the point it's generated — caught before the backend layer was written, not after.** The initial design carried `instrumentId : InstrumentId` and `sec : Party`, mirroring `InvestmentNote`. But a compliance report is generated at the Trustee-review stage: before issuance creates an `InstrumentId` (Milestone 5) and before SEC is even chosen (only happens at submission time, Milestone 4). Corrected to a bare `dealId : Text` — matching `AuditLog`'s own pattern, since neither template is ever fetched or exercised against by contract ID elsewhere, only displayed — and dropped `sec` entirely. Both the DAML template and its test file were rewritten to match before the DAR was rebuilt.

2. **A real bug in the compliance-report route was caught by an automated test, not a manual check.** `POST /trustee-reviews/:contractId/compliance-report` originally responded with `{ report, document: reportDoc }`, but `invokeReportingAgent` returns the full envelope (`{agent, output, model, timestamp}`), not the `GeneratedReport` itself — so `document.markdown` was always `undefined`. Caught by a failing assertion in `reports.test.ts` (`createRes.body.document.markdown`), fixed to `document: reportDoc.output`, re-verified by rerunning the specific test file (5/5) and then the full backend suite (36/36).

3. **The regulatory report's missing certification/approval notes were caught live in the browser, not by any automated test — the same pattern that has now recurred across multiple milestones.** The SEC's regulatory report initially showed "Not yet certified." / "Not yet approved." even though both existed on-ledger, reachable via the note's `approvalCid` → `SECApproval.certificationNotes`/`approvalNotes`. The route simply never fetched the approval record. Fixed by adding `findApprovalById(party, note.approvalCid)` and passing its fields into the Reporting Agent call. Every integration test that exercised this route used a note whose approval happened to have been created with those fields blank-tolerant, so nothing failed — only a real walkthrough with a genuinely certified, genuinely approved note exposed the gap.

4. **The SEC's regulatory report naturally omits per-investor distribution detail — a privacy boundary carried forward from Milestone 7, not a gap in Milestone 8.** `ProfitDistribution` (Milestone 7) deliberately does not name SEC as an observer, keeping per-investor payout amounts away from parties that aren't the investor/issuer/custodian/trustee. A SEC-generated regulatory report therefore correctly shows 0 distributions, while an Issuing-House-generated one for the same note is naturally more complete. This was reasoned through explicitly and left as a code comment in `api/reports.ts` rather than "fixed" by widening `ProfitDistribution`'s observer set, which would have re-opened a settled privacy design from the prior milestone for no requirement in this one.

## Verified live (not just automated tests)
Logged in as the Issuing House and generated a management report for an already-issued note from a prior milestone's walkthrough, confirming its subscription and distribution facts matched the ledger exactly. Opened a pending Trustee review, clicked "Generate compliance report," and confirmed the persisted `ComplianceReport` and its markdown both reflected the real gap list from the Compliance Agent. Logged in as the Investor and opened "Investor report," confirming it listed exactly the calling investor's own holdings and statements (no cross-investor leakage, consistent with Milestone 7's isolation guarantee). Logged in as the SEC and opened a regulatory report — this is where Findings #3 was caught and fixed live; re-queried via a direct `fetch` call in the browser console after the backend's `tsx watch` auto-restarted, confirming the corrected markdown showed real certification/approval text ("Structure conforms to Ijarah principles; underlying asset ownership verified." / "Governance and investor-protection terms are adequate for this issuance.") while distributions correctly remained at 0 (Findings #4). Logged in as the Trustee and confirmed the read-only "Compliance reports" card listed the same persisted report visible to the Issuing House. Finally, queried `GET /audit-log` directly as the Platform Operator and confirmed 51 total entries correctly bucketed across all 5 `AuditEventKind` values (`ComplianceCheckPerformed: 32`, `ReportGenerated: 13`, `StructuringRecommendationShown: 4`, `DocumentGenerated: 1`, `RiskAssessmentPerformed: 1`) — proving the audit trail genuinely captures activity across the whole session's agent invocations, not just this milestone's own scripted walkthrough. No console errors, no failed network requests at any step.

## How to run this locally
Same as [milestone-7.md](milestone-7.md) — all four services (`dpm sandbox`, `backend`, `agents`, `frontend`) need to be running. No new environment variables, no new dependencies.

## Next
Milestone 9 — Hardening & production readiness (security pass across JWT/RBAC/input validation/audit-logging completeness; observability; a full timed end-to-end run of all 15 workflow steps; DevNet → TestNet promotion; finalized docs).
