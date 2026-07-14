import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "./jwt.js";
import type { AuthClaims, Role } from "./types.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    req.auth = verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "missing bearer token" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: `requires role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
}
