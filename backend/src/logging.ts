import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

type Level = "info" | "warn" | "error";

// One JSON line per event — the shape a log aggregator (CloudWatch, Loki,
// whatever the NaaS host's logging story turns out to be per §3.6) can
// parse without a custom grok pattern. No logging library dependency: this
// project's dependency list stays intentionally small (see Milestone 0's
// "generated client over @c7/ledger" reasoning), and a JSON.stringify line
// is all structured logging actually requires here.
function log(level: Level, message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...fields }));
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => log("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => log("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => log("error", message, fields),
};

// Assigns a request id up front (before auth/RBAC/route handling runs) so
// every log line and the X-Request-Id response header can correlate back to
// one request — including 401/403s that never reach a route handler. Logs
// on `finish`, not here, so req.auth (set by requireAuth, which runs after
// this middleware) is populated by the time the line is written.
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      role: req.auth?.role,
      org: req.auth?.org,
    });
  });
  next();
}
