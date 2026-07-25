// Must be the very first import: config.js reads process.env at module-load
// time, so `.env` has to be populated before anything else executes. `dotenv`
// has been a listed dependency since Milestone 0 but was never actually
// invoked anywhere — every prior milestone's local dev happened to work
// entirely on config.ts's built-in defaults, so the gap went unnoticed until
// a real DevNet token needed to be injected without exporting it into shell
// history.
import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
// Must be imported before any router below: Express 4 doesn't route a
// rejected promise from an async handler to error-handling middleware on
// its own — without this, an unhandled ledger error (e.g. an unknown
// party) crashes the whole Node process instead of producing a 500.
// Discovered directly in Milestone 6 when a bad request against the new
// investor-signup route took the whole dev server down — see
// docs/milestones/milestone-6.md Findings.
import "express-async-errors";
import cors from "cors";
import { config } from "./config.js";
import { logger, requestLogger } from "./logging.js";
import { healthRouter } from "./api/health.js";
import { authRouter } from "./api/auth.js";
import { orgsRouter } from "./api/orgs.js";
import { proposalsRouter } from "./api/proposals.js";
import { structuresRouter } from "./api/structures.js";
import { reviewsRouter } from "./api/reviews.js";
import { regulatoryRouter } from "./api/regulatory.js";
import { issuanceRouter } from "./api/issuance.js";
import { investorSignupRouter } from "./api/investorSignup.js";
import { investorsRouter } from "./api/investors.js";
import { subscriptionsRouter } from "./api/subscriptions.js";
import { distributionsRouter } from "./api/distributions.js";
import { reportsRouter } from "./api/reports.js";

export const app = express();
// See config.ts's `allowedOrigin` doc comment: unset (dev default) reflects
// any Origin; production deployments must set ALLOWED_ORIGIN.
app.use(cors(config.allowedOrigin ? { origin: config.allowedOrigin } : undefined));
app.use(express.json());
app.use(requestLogger);
app.use(healthRouter);
app.use(authRouter);
// investorSignupRouter is genuinely public (no requireAuth) and MUST be
// registered before any router with an unconditional `.use(requireAuth)`
// below — Express runs each mounted router's own middleware for every
// request that reaches it, not just ones matching that router's routes,
// so a `requireAuth`-gated router registered first would 401 a public
// request before it ever reaches investorSignupRouter's matching route.
app.use(investorSignupRouter);
app.use(orgsRouter);
app.use(proposalsRouter);
app.use(structuresRouter);
app.use(reviewsRouter);
app.use(regulatoryRouter);
app.use(issuanceRouter);
app.use(investorsRouter);
app.use(subscriptionsRouter);
app.use(distributionsRouter);
app.use(reportsRouter);

// Catch-all: turns any error `express-async-errors` routes here (ledger
// failures, programming errors) into a 500 instead of a process crash.
// Deliberately generic — this is a safety net, not a place to add
// per-error business logic (that belongs in the route itself, as the
// 400/403/404/409 responses throughout these routers already do).
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error("unhandled error", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: "internal server error", requestId: req.requestId });
};
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    logger.info("backend listening", { port: config.port, ledgerApiUrl: config.ledgerApiUrl });
  });
}
