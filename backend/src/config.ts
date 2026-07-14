export const config = {
  port: Number(process.env.PORT ?? 4000),
  ledgerApiUrl: process.env.LEDGER_API_URL ?? "http://localhost:7575",
  // Package name (daml.yaml `name`), not the content hash — the JSON Ledger
  // API's package-name reference format (`#name:Module:Entity`) survives
  // DAR rebuilds, unlike the deprecated package-id format.
  packageName: process.env.DAML_PACKAGE_NAME ?? "amanax-main",
  // Sandbox has no ledger-API auth, so there's no token to derive a user-id
  // from (see JsCommands.userId in the generated schema); everything this
  // backend submits uses one fixed ledger user-id.
  ledgerUserId: process.env.LEDGER_USER_ID ?? "amanax-backend",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me",
  // Bootstraps the one human operator allowed to log in before any User
  // contract exists — see backend/src/auth/devLogin.ts.
  operatorEmail: process.env.OPERATOR_EMAIL ?? "operator@amanax.dev",
  // The agents/ service (LangGraph.js) — see docs/implementation_plan.md
  // §6.4. Only the backend ever calls this; it never holds ledger
  // credentials and is never called directly by the frontend.
  agentsServiceUrl: process.env.AGENTS_SERVICE_URL ?? "http://localhost:4100",
};
