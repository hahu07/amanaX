# AmanaX

**AI-powered Islamic capital market infrastructure, built on Canton Network.**

AmanaX digitises the full lifecycle of a Shariah-compliant investment product — from product design and structuring through regulatory approval, issuance, investor onboarding, subscription, profit distribution, and compliance reporting — replacing the disconnected emails, spreadsheets, and paper-based coordination that fund managers, issuing houses, trustees, Shariah advisors, custodians, distributors, and regulators currently rely on.

For the MVP, AmanaX demonstrates this end-to-end for a **Shariah-compliant Investment Note**, but the same architecture extends to Sukuk, Ijarah funds, Musharakah/Mudarabah funds, and other Islamic capital market instruments without core changes.

## Why Canton Network

Multi-party financial workflows need two things most platforms fight each other on: a single shared source of truth, and strict need-to-know privacy between counterparties. Canton's privacy model gives every participant (Fund Manager, Issuing House, Trustee, Shariah Advisor, Custodian, Distributor, Investor, SEC) visibility only into the deals they're actually a stakeholder in, while still settling atomically against one ledger. AI agents assist throughout — recommending structures, checking compliance, assessing risk, drafting documents, generating reports — but are strictly advisory: every investment, regulatory, and Shariah decision stays with an authorised human, enforced by the ledger's own authorization rules, not application code.

## Architecture

```
Daml Ledger (Canton)          — source of truth: state, business rules, authorization
        ↑ JSON Ledger API (JWT-authenticated)
TypeScript Backend             — REST API, RBAC, AI orchestration, reporting
        ↑ REST                          ↑ internal API (no ledger access)
React Frontend                 agents/ service (advisory AI agents)
```

- **`daml/`** — the ledger model: Organization/User identity, ProductProposal → ProductStructure → InvestmentNote lifecycle, Shariah/Trustee review, regulatory submission & SEC approval, investor subscription/allocation, profit distribution, compliance reporting/audit log. Templates implement the Canton **Token Standard** (CIP-0056) — Token Metadata and Holding interfaces — so issued notes interoperate with any Token-Standard-aware wallet or custody tooling.
- **`backend/`** — Express/TypeScript REST API. Talks to the ledger via a client generated from the JSON Ledger API's own OpenAPI spec. Owns RBAC, JWT issuance, and all agent orchestration; the frontend and agents service never touch the ledger directly.
- **`agents/`** — advisory-only AI agents (Product Structuring, Compliance, Risk, Documentation, Reporting), reachable only from the backend.
- **`frontend/`** — React dashboards, one per role (Operator, Fund Manager/Issuer, Issuing House, Shariah Advisor, Trustee, Custodian, Distributor, Investor, SEC).

## Status

Built through 9 milestones — identity & RBAC, product structuring, Shariah/Trustee review, regulatory approval, Token Standard issuance, investor onboarding & allocation, profit distribution, compliance reporting, and security hardening. The full deal lifecycle (proposal → structuring → Shariah certification → Trustee approval → SEC approval → issuance → investor KYC/subscription/allocation → profit distribution) has been verified both against a local Canton sandbox and live against a real Canton Network DevNet participant.

## Running locally

Four processes, in order — see `.env.example` in `backend/`, `agents/`, and `frontend/` for configuration:

```bash
# 1. Local Canton ledger (JSON API on :7575)
dpm sandbox --dar daml/main/.daml/dist/amanax-main-0.0.1.dar --json-api-port 7575

# 2. AI agents service (:4100)
cd agents && npm install && npm run dev

# 3. Backend API (:4000)
cd backend && npm install && npm run dev

# 4. Frontend (:5173)
cd frontend && npm install && npm run dev
```

No `.env` is required for local dev — every variable has a dev-safe default. Log in with `operator@amanax.dev` (no password — this environment uses dev-login by email; production would swap in real OIDC) to onboard the other organizations from the Operator dashboard.

**New here?** See [`WALKTHROUGH.md`](./WALKTHROUGH.md) for a step-by-step script through the full deal lifecycle — which demo account to use at each stage and exactly what to click.

## Deploying

`render.yaml` deploys all three services (frontend, backend, agents) as a single Render Blueprint. Deploying against a real Canton Network DevNet/TestNet participant additionally needs a bearer token — see the `LEDGER_OIDC_*` variables, which drive an unattended refresh-token flow so the backend renews its own access token indefinitely rather than needing one pasted in by hand.

## Tech stack

Daml (Canton Network) · TypeScript · Express · React · Vite · LangGraph.js
