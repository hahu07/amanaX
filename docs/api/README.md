# AmanaX Backend REST API Reference

Hand-maintained, not generated. `implementation_plan.md` §3.2 sketched a generated-OpenAPI-spec approach for this
backend's own REST surface, but no milestone actually wired that up — the OpenAPI spec this project *does* consume
(`GET /docs/openapi` in `docs/implementation_plan.md` §2) belongs to the DAML JSON Ledger API our backend talks to,
not to this backend's own routes. Adding an OpenAPI generator for ~50 routes at the end of the project (Milestone 9)
would be new surface area with no consumer yet; a hand-written reference kept next to the route files it describes
is the accurate, low-maintenance choice for this MVP. Every route below is grep-verified against `backend/src/api/*.ts`
as of Milestone 9.

All routes except `POST /investor-signup`, `GET /distributors`, `GET /orgs`, and `GET /health` require
`Authorization: Bearer <jwt>` (`requireAuth`); most routes additionally require one of the listed roles
(`requireRole`). A request without a valid token gets `401`; a valid token with the wrong role gets `403`.

## Auth

| Method | Path | Role | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | — (public, rate-limited) | `{ email }` | Dev-login placeholder for real OIDC — see `docs/deployment.md` |
| GET | `/me` | any authenticated | — | Echoes the caller's own JWT claims |

## Organizations & users (Platform Operator)

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/orgs` | PlatformOperator | `{ name, role }` |
| GET | `/orgs` | any authenticated | — |
| PATCH | `/orgs/:contractId/active` | PlatformOperator | `{ active: boolean }` |
| POST | `/users` | PlatformOperator | `{ org, userId, email, displayName, role }` |
| GET | `/users?org=` | PlatformOperator | — |

## Investor self-service signup (public)

| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/distributors` | — (public) | — |
| POST | `/investor-signup` | — (public, rate-limited) | `{ fullName, email, distributor }` |

## Product proposal & structuring (Steps 1-4)

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/proposals` | FundManager, Issuer | `{ issuingHouse, productName, description, proposedType, targetSizeNGN, tenorMonths }` |
| GET | `/proposals` | FundManager, Issuer, IssuingHouse | — |
| POST | `/proposals/:contractId/withdraw` | FundManager, Issuer | — |
| POST | `/proposals/:contractId/reject` | IssuingHouse | — |
| POST | `/proposals/:contractId/structuring-recommendation` | IssuingHouse | — (AI Product Structuring Agent, advisory) |
| POST | `/proposals/:contractId/structure` | IssuingHouse | `{ structureType, profitMechanism, minSubscriptionNGN, redemptionTerms, structureTenorMonths }` |
| GET | `/structures` | FundManager, Issuer, IssuingHouse | — |
| PATCH | `/structures/:contractId` | IssuingHouse | `{ newStructureType, newProfitMechanism, newMinSubscriptionNGN, newRedemptionTerms, newTenorMonths }` |
| POST | `/structures/:contractId/finalize` | IssuingHouse | — |

## Shariah & Trustee review (Steps 5-7)

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/structures/:contractId/submit-shariah-review` | IssuingHouse | `{ shariahAdvisor }` |
| GET | `/shariah-reviews` | IssuingHouse, ShariahAdvisor, FundManager, Issuer | — |
| POST | `/shariah-reviews/:contractId/certify` | ShariahAdvisor | `{ certificationNotes }` |
| POST | `/shariah-reviews/:contractId/reject` | ShariahAdvisor | `{ rejectionReason }` |
| POST | `/shariah-reviews/:contractId/withdraw` | IssuingHouse | — |
| POST | `/shariah-reviews/:contractId/submit-trustee-review` | IssuingHouse | `{ trustee }` |
| GET | `/trustee-reviews` | IssuingHouse, Trustee, FundManager, Issuer | — |
| POST | `/trustee-reviews/:contractId/approve` | Trustee | `{ approvalNotes }` |
| POST | `/trustee-reviews/:contractId/reject` | Trustee | `{ rejectionReason }` |
| POST | `/trustee-reviews/:contractId/withdraw` | IssuingHouse | — |
| POST | `/trustee-reviews/:contractId/compliance-check` | IssuingHouse | — (AI Compliance Agent preview, advisory) |

## Regulatory submission & SEC approval (Steps 8-9)

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/trustee-reviews/:contractId/generate-filing-pack` | IssuingHouse | — (AI Documentation Agent preview) |
| POST | `/trustee-reviews/:contractId/submit-to-sec` | IssuingHouse | `{ sec }` — re-runs the Compliance Agent as a real gate |
| GET | `/regulatory-submissions` | IssuingHouse, SEC, FundManager, Issuer, Trustee | — |
| POST | `/regulatory-submissions/:contractId/approve` | SEC | `{ approvalReference }` |
| POST | `/regulatory-submissions/:contractId/reject` | SEC | `{ rejectionReason }` |
| POST | `/regulatory-submissions/:contractId/withdraw` | IssuingHouse | — |

## Issuance (Step 10)

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/sec-approvals/:contractId/issue` | IssuingHouse | `{ symbol, parValueNGN }` |
| GET | `/investment-notes` | IssuingHouse, SEC, FundManager, Issuer, Trustee, Investor, Custodian | — |
| GET | `/investment-notes/:contractId/metadata` | (same as above) | — Token Standard `{ instrumentId, meta }` |

## Investor onboarding, subscription, allocation (Steps 11-13)

| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/investor-profiles` | Distributor, PlatformOperator, Investor | — |
| POST | `/investor-profiles/:contractId/verify` | Distributor | — |
| POST | `/investor-profiles/:contractId/reject` | Distributor | `{ rejectionReason }` |
| POST | `/investment-notes/:contractId/subscribe` | Investor | `{ amountNGN }` |
| GET | `/subscriptions` | Investor, Distributor, IssuingHouse, FundManager, Issuer | — |
| POST | `/subscriptions/:contractId/risk-check` | Distributor | — (AI Risk Agent preview, advisory) |
| POST | `/subscriptions/:contractId/allocate` | Distributor | `{ allocatedAmountNGN, riskNotes }` |
| POST | `/subscriptions/:contractId/reject` | Distributor | `{ rejectionReason }` |
| POST | `/subscriptions/:contractId/withdraw` | Investor | — |

## Profit distribution (Step 14)

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/investment-notes/:contractId/distributions` | Custodian | `{ periodLabel, totalAmountNGN }` — pro-rata shares server-computed |
| GET | `/distribution-requests` | Custodian, Trustee, IssuingHouse, FundManager, Issuer | — |
| POST | `/distribution-requests/:contractId/approve` | Trustee | — |
| POST | `/distribution-requests/:contractId/reject` | Trustee | `{ rejectionReason }` |
| POST | `/distribution-requests/:contractId/withdraw` | Custodian | — |
| GET | `/profit-distributions` | Custodian, Trustee, IssuingHouse, FundManager, Issuer, Investor | — scoped per-party by Daml observer visibility |

## Reporting & compliance (Step 15)

| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/investment-notes/:contractId/reports/management` | IssuingHouse | — (AI Reporting Agent) |
| GET | `/reports/investor` | Investor | — (AI Reporting Agent, own portfolio) |
| POST | `/trustee-reviews/:contractId/compliance-report` | IssuingHouse | — persists a `ComplianceReport` + generates a document |
| GET | `/compliance-reports` | IssuingHouse, Trustee, FundManager, Issuer | — |
| GET | `/investment-notes/:contractId/reports/regulatory` | SEC, IssuingHouse | — (AI Reporting Agent) |
| GET | `/audit-log` | any authenticated | — PlatformOperator sees everything, everyone else sees their own entries |

## Misc

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | — (public) | `{ backend, ledger: { reachable, offset } }` |

## Conventions

- **Validation**: every route with a body validates it with Zod before touching the ledger; a failed validation
  returns `400` with `{ error: <zod flatten output> }`.
- **Errors**: `401` missing/invalid token, `403` wrong role, `404` contract not found (or not visible to the
  caller's party), `409` a business-rule conflict enforced backend-side (e.g. "structure must be Finalized",
  "would exceed target size"), `500` unexpected failure — every `500` body includes `requestId` for correlating
  against the backend's structured logs (see `docs/deployment.md` → Observability).
- **Party derivation**: fields like `sponsorType`, `issuedAt`, or which party a route acts as are always derived
  server-side from the caller's JWT (`requireOrgParty`) or from an already-created ledger record, never trusted
  from the request body — see the "server-derived" comments throughout `backend/src/api/*.ts`.
