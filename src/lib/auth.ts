import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/bootstrap";
import { users } from "@/db/schema";
import { getJwtExpiresIn, getJwtSecret } from "@/lib/env";

export const BCRYPT_SALT_ROUNDS = 10;
export const AUTH_COOKIE = "musaafir_token";
export const TOKEN_STORAGE_KEY = "musaafir_token";

export type PublicUser = { id: number; name: string; email: string };
export type JwtPayload = { sub: string; email: string; name: string; iat?: number; exp?: number };

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/* ── normalisation ─────────────────────────────────────────────────────────── */

/** Emails are ALWAYS stored and looked up lowercase + trimmed (a top cause of "Invalid email or password"). */
export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/* ── passwords ─────────────────────────────────────────────────────────────── */

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash || typeof passwordHash !== "string") {
    console.error("[AUTH] stored password_hash is empty - this row cannot be used to log in");
    return false;
  }
  try {
    return await compare(plain, passwordHash);
  } catch (error) {
    console.error("[AUTH] bcrypt.compare failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/* ── tokens ────────────────────────────────────────────────────────────────── */

export function signToken(user: PublicUser): string {
  const options: SignOptions = { expiresIn: getJwtExpiresIn() as SignOptions["expiresIn"] };
  return jwt.sign({ sub: String(user.id), email: user.email, name: user.name }, getJwtSecret(), options);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded === "string") return null;
    return decoded as JwtPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[AUTH] token verification failed:", message);
    return null;
  }
}

export function toPublicUser(row: { id: number; name: string; email: string }): PublicUser {
  return { id: row.id, name: row.name, email: row.email };
}

/* ── request helpers ───────────────────────────────────────────────────────── */

export function getTokenFromRequest(request: NextRequest | Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [key, ...rest] = part.trim().split("=");
      if (key === AUTH_COOKIE && rest.length) return decodeURIComponent(rest.join("="));
    }
  }
  if ("cookies" in request) {
    try {
      const cookie = (request as NextRequest).cookies.get(AUTH_COOKIE)?.value;
      if (cookie) return cookie;
    } catch {
      /* request without cookie store (unit tests) */
    }
  }
  return null;
}

/** Verify the bearer token/cookie AND confirm the user still exists in Postgres. */
export async function getAuthUser(request: NextRequest | Request): Promise<PublicUser | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload?.sub) return null;

  await ensureDatabaseReady();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, Number(payload.sub)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return toPublicUser(row);
}

/** Throws AuthError(401) when the caller is not authenticated. */
export async function requireAuthUser(request: NextRequest | Request): Promise<PublicUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new AuthError("Unauthorized - please login again", 401);
  }
  return user;
}
