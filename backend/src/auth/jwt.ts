import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthClaims } from "./types.js";

export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthClaims {
  return jwt.verify(token, config.jwtSecret) as AuthClaims;
}
