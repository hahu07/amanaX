# AI Implementation Prompt – Build the AmanaX MVP on Canton

You are a senior **DAML, Canton, TypeScript, React, LangGraph, and AI Systems Architect** with deep expertise in the Nigerian capital market, Islamic finance, distributed ledger technology, and enterprise software.

Your task is to design and build a production-quality MVP of **AmanaX**, an AI-powered Islamic Capital Market Infrastructure Platform for Nigeria, using the Canton Network.

The solution must be modular, scalable, well-documented, production-ready, and follow Canton and DAML best practices.

---

# Project Overview

AmanaX enables Nigerian capital market institutions to design, structure, approve, issue, distribute, and manage Shariah-compliant investment products through secure, AI-assisted workflows.

The MVP will demonstrate the complete lifecycle of an **Islamic Investment Note**.

The platform must support collaboration between:

* Platform Operator
* Fund Manager (Product Sponsor)
* Issuing House (Workflow Orchestrator)
* Trustee
* Shariah Advisor
* Custodian
* Distributor
* Investor
* SEC

The architecture consists of three layers:

* DAML Model
* TypeScript Backend
* React Frontend

---

# Layer 1 – DAML Model

The DAML model is the source of truth.

All business rules, authorization, and workflow state transitions must be enforced on-ledger.

Implement templates for:

* Organization
* User
* ProductProposal
* InvestmentNote
* ProductStructure
* ShariahReview
* TrusteeReview
* RegulatorySubmission
* SECApproval
* ProductIssuance
* InvestorProfile
* Subscription
* Allocation
* ProfitDistribution
* ComplianceReport
* AuditLog

Each template must implement:

* Signatories
* Controllers
* Observers
* Choices
* Authorization rules
* Validation rules
* Lifecycle transitions

Use Canton privacy and multi-party authorization correctly.

---

# Layer 2 – Backend (TypeScript)

Develop a TypeScript backend that communicates with the Canton Validator through the Ledger API.

Responsibilities include:

* Authentication
* Authorization
* REST API
* OpenAPI specification
* Workflow orchestration
* AI orchestration
* Ledger queries
* External integrations
* Notifications
* Reporting

The backend must never duplicate business rules enforced in DAML.

---

# Layer 3 – Frontend (React)

Build a React application.

The frontend communicates only with the backend through REST APIs.

Never connect directly to the Ledger API.

Create dashboards for:

* Platform Operator
* Fund Manager
* Issuing House
* Trustee
* Shariah Advisor
* Custodian
* Distributor
* Investor
* SEC

Each role must only see information it is authorized to access.

---

# AI Agents

Implement AI agents as advisory assistants.

The AI must never make regulatory or investment decisions.

Agents include:

### Product Structuring Agent

Assists the Issuing House by recommending:

* investment structure
* product terms
* workflow guidance
* documentation

### Compliance Agent

Checks:

* regulatory readiness
* missing documents
* Shariah checklist
* workflow completeness

### Documentation Agent

Generates:

* term sheets
* investment summaries
* approval packs
* regulatory filing documents

### Risk Agent

Assists with:

* product risk assessment
* operational risk review
* concentration analysis

### Reporting Agent

Generates:

* management reports
* investor reports
* compliance reports
* regulatory reports

All AI outputs must be structured, validated, auditable, and treated as recommendations only.

---

# MVP Workflow

Implement the following workflow:

### Step 1

Fund Manager proposes a new Islamic Investment Product.

↓

### Step 2

Issuing House reviews the proposal and structures an Islamic Investment Note.

↓

### Step 3

AI Product Structuring Agent recommends improvements.

↓

### Step 4

Issuing House finalizes the product structure.

↓

### Step 5

Shariah Advisor reviews and certifies compliance.

↓

### Step 6

Trustee reviews governance and investor protection.

↓

### Step 7

AI Compliance Agent validates regulatory readiness.

↓

### Step 8

Issuing House prepares and submits the application to SEC.

↓

### Step 9

SEC reviews and approves the issuance.

↓

### Step 10

Investment Note is issued.

↓

### Step 11

Investors complete onboarding.

↓

### Step 12

Investors subscribe.

↓

### Step 13

Subscriptions are allocated.

↓

### Step 14

Profit distributions are processed.

↓

### Step 15

AI Reporting Agent generates management, trustee, and regulatory reports.

---

# Security

Implement:

* JWT Authentication
* Role-Based Access Control
* Audit Logging
* Input Validation
* Secure REST APIs
* Error Handling

---

# Code Quality

The implementation must:

* Follow Canton best practices.
* Follow DAML best practices.
* Follow TypeScript best practices.
* Follow React best practices.
* Be modular and production-ready.
* Include documentation.
* Include unit tests.
* Include integration tests.
* Include sample data.

---

# Deliverables

Build the project incrementally.

For every milestone provide:

* System architecture
* Folder structure
* DAML model
* Backend implementation
* Frontend implementation
* API documentation
* Test cases
* Deployment instructions

Do not proceed to the next milestone until the current milestone compiles, runs successfully, and passes its tests.

---

# Success Criteria

The MVP is complete when an Issuing House can successfully structure, obtain approvals for, issue, and distribute a Shariah-compliant Investment Note through AI-assisted workflows on the Canton Network in under five minutes, with every approval and transaction securely recorded on the ledger.
