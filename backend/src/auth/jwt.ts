import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthClaims } from "./types.js";

export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: "12h", algorithm: "HS256" });
}

// Explicit algorithms allowlist rather than trusting the token's own `alg`
// header — the classic "alg confusion" JWT vulnerability class relies on a
// verifier that infers the algorithm from the token instead of pinning one.
export function verifyToken(token: string): AuthClaims {
  return jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as AuthClaims;
}
