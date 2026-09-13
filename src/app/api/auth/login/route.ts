import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/bootstrap";
import { users } from "@/db/schema";
import { apiHandler, badRequest, readJson } from "@/lib/api";
import { AUTH_COOKIE, isValidEmail, normalizeEmail, signToken, verifyPassword } from "@/lib/auth";
import { getJwtExpiresIn } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login  { email, password }
 * -> 200 { token, user } or 401 "Invalid email or password".
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await readJson(request);

  const rawEmail = body.email;
  const password = String(body.password ?? "");
  const email = normalizeEmail(rawEmail);

  console.log(`[LOGIN] attempt email="${email}" (raw="${rawEmail}") passwordLength=${password.length}`);

  if (!email) return badRequest("Email is required");
  if (!isValidEmail(email)) return badRequest("Please enter a valid email address");
  if (!password) return badRequest("Password is required");

  await ensureDatabaseReady();

  // Lowercase + trimmed lookup so mixed-case signups still authenticate.
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  const user = rows[0];

  if (!user) {
    console.log(`[LOGIN] failed - no user found for ${email}`);
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }

  console.log(`[LOGIN] user found id=${user.id}, hash prefix=${user.passwordHash?.slice(0, 7) ?? "(empty)"}`);

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  console.log(`[LOGIN] bcrypt.compare result for id=${user.id}: ${passwordMatches}`);

  if (!passwordMatches) {
    console.log(`[LOGIN] failed - password mismatch for ${email}`);
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }

  const publicUser = { id: user.id, name: user.name, email: user.email };
  const token = signToken(publicUser);
  console.log(`[LOGIN] success - issued JWT for ${publicUser.email} expiring in ${getJwtExpiresIn()}`);

  const response = NextResponse.json({
    message: "Login successful",
    token,
    user: publicUser,
    expiresIn: getJwtExpiresIn(),
  });

  // Cookie mirror of the localStorage token, handy for server-rendered pages.
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
});

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization" },
  });
}
