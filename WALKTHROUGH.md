# AmanaX — Judge's Walkthrough

A step-by-step script for driving the full deal lifecycle through the live UI. Every step below has actually been run end-to-end against a real Canton Network DevNet participant — this is not a mockup.

**Demo site:** the login page lists every account below under "Demo accounts — click to sign in as that role." No passwords — click a row and you're in.

The story: a Fund Manager proposes a Shariah-compliant Investment Note → an Issuing House structures it (with AI help) → a Shariah Advisor certifies it → a Trustee approves it → the SEC approves the regulatory filing → the Issuing House issues the note → an Investor subscribes → a Distributor allocates units (with AI risk input) → a Custodian proposes a profit distribution and the Trustee approves it → everyone pulls their own compliance report.

Each role only ever sees the deals it's actually a stakeholder in — that's enforced by the ledger itself, not the UI.

---

## 1. Platform Operator — onboard the organizations

Log in as **Platform Operator** (`operator@amanax.dev`).

- **Organizations** tab → **Onboard organization** → create/confirm orgs for each role (Fund Manager, Issuing House, Trustee, Shariah Advisor, Custodian, Distributor, SEC, Issuer).
- **Users** tab → **Onboard user** → attach a login email to each organization.
- (On the hosted demo this is already seeded — feel free to skip straight to step 2.)

## 2. Fund Manager / Issuer — propose the product

Log in as **Fund Manager** (`fm@amana.ng`) or **Issuer** (`rid@amana.ng`).

- **Proposals** tab → **Propose a product** → fill in Issuing House, Product name, Proposed structure (Murabahah/Ijarah/Wakalah/Mudarabah), Target size, Tenor, Description → **Submit proposal**.

## 3. Issuing House — structure it, with AI assistance

Log in as **Issuing House** (`ade@amanafin.ng`).

- **Proposals** tab → **Review** on the new proposal. This opens the **AI Product Structuring Agent** panel — it shows a confidence badge and a recommended set of terms. Click **Use recommended terms** to pre-fill the structuring form, or edit manually (Structure type, Tenor, Min. subscription, Profit mechanism, Redemption terms) → **Structure this product**.
- **Structures** tab → finalize the draft (**Edit / finalize** → **Finalize structure**), then **Submit for Shariah review** and pick the Shariah Advisor.

## 4. Shariah Advisor — certify

Log in as **Shariah Advisor** (`advisor@amanashariah.ng`).

- **Reviews** tab → **Review** → read the deal summary (profit mechanism, redemption terms, min. subscription) → write **Certification notes** → **Certify** (or **Reject** with a reason).

## 5. Issuing House — send to Trustee

Back as **Issuing House** — **Shariah reviews** tab → **Submit for Trustee review**, pick the Trustee.

## 6. Trustee — approve

Log in as **Trustee** (`trustee@amanatrustee.ng`).

- **Reviews** tab → **Review** → see the Shariah certification notes → write **Approval notes** → **Approve** (or **Reject**).

## 7. Issuing House — compliance check and SEC filing

Back as **Issuing House** — **Trustee reviews** tab → **Check compliance**. This opens the **AI Compliance Agent** panel: "Workflow gaps," "Shariah checklist gaps," "Documents still needed for SEC filing," and a "Ready for submission" badge. Once ready:

- **Generate compliance report** → **Generate filing pack** → pick the SEC organization → **Submit to SEC**.

## 8. SEC — approve the filing

Log in as **SEC** (`reviewer@sec.gov.ng`).

- **Filings** tab → **Review** → expand the submitted documents → enter an **Approval reference** (e.g. `SEC/AMX/2026/0001`) → **Approve** (or **Reject** with a reason).

## 9. Issuing House — issue the note

Back as **Issuing House** — **Regulatory submissions** tab → **Issue note** on the approved filing → set **Symbol** and **Par value per unit** → **Issue Investment Note**. This mints the note under Canton's Token Standard (Token Metadata + Holding interfaces).

## 10. Investor — sign up and subscribe

New investor? Use **"New investor? Create an account"** on the login page (no ID verification required in this demo) and pick a Distributor. Or log in directly as the seeded **Investor** (`yusuf.garba@investor.ng`).

- **Notes** tab → **Subscribe** on the issued note → enter an **Amount** → **Subscribe**. (Requires KYC — see step 11 if it shows "KYC required.")

## 11. Distributor — verify KYC, allocate with AI risk input

Log in as **Distributor** (`distributor@amanadist.ng`).

- **Investor KYC** tab → **Review** → **Verify KYC** (or **Reject**).
- **Subscriptions** tab → **Review** on the investor's subscription. This opens the **AI Risk Agent** panel — concentration and overall-risk badges. Enter an **Allocated amount** and optional **Risk notes** → **Allocate** (or **Reject**).

## 12. Custodian — propose a profit distribution

Log in as **Custodian** (`custodian@amanacustody.ng`).

- **Investment notes** tab → **Propose distribution** → enter **Period** (e.g. `Q1 2026`) and **Total distributable amount** → **Calculate & propose**.

## 13. Trustee — approve the distribution

Back as **Trustee** — **Pending distributions** tab → **Review** → check the per-investor share breakdown → **Approve** (or **Reject**).

## 14. Everyone — pull a compliance report

Every dashboard has a **Reports** tab with a role-scoped report (**Generate report**): Fund Manager/Issuer compliance report, Shariah certification report, Trustee compliance report, SEC filing report, Distributor portfolio report, Investor statement, Custodian distribution report, and the Operator's platform-wide report + audit log. Each only shows what that role is entitled to see — that's the point.

---

### Why this proves more than a script could

Every approval, rejection, and state transition above is an authorization rule enforced by the Daml ledger itself — not application code you're trusting us on. Try logging in as a role that *shouldn't* see a given deal (e.g. a Distributor not attached to it) and it simply won't appear.
