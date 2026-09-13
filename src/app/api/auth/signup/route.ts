import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/bootstrap";
import { users } from "@/db/schema";
import { apiHandler, badRequest, readJson } from "@/lib/api";
import { BCRYPT_SALT_ROUNDS, hashPassword, isValidEmail, normalizeEmail, signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup  { name, email, password }
 * Hashes with bcrypt (10 salt rounds) and returns { message: "User created", user }.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await readJson(request);

  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");

  console.log(`[SIGNUP] attempt for name="${name}" email="${email}" passwordLength=${password.length}`);

  if (name.length < 2) return badRequest("Please enter your name (at least 2 characters)");
  if (name.length > 120) return badRequest("Name is too long (max 120 characters)");
  if (!email) return badRequest("Email is required");
  if (!isValidEmail(email)) return badRequest("Please enter a valid email address");
  if (password.length < 6) return badRequest("Password must be at least 6 characters");
  if (password.length > 72) return badRequest("Password is too long (max 72 characters)");

  // Guarantees the users table exists even if `drizzle-kit push` / `npm run seed` were skipped.
  await ensureDatabaseReady();

  const existing = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing.length > 0) {
    console.log(`[SIGNUP] rejected - user already exists for ${email}`);
    return NextResponse.json({ message: "User already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  console.log(
    `[SIGNUP] bcrypt hash generated (${BCRYPT_SALT_ROUNDS} salt rounds, prefix=${passwordHash.slice(0, 7)}, length=${passwordHash.length})`,
  );

  try {
    const inserted = await db
      .insert(users)
      .values({ name, email, passwordHash })
      .returning({ id: users.id, name: users.name, email: users.email });

    const user = inserted[0];
    if (!user) {
      return NextResponse.json({ message: "Could not create user, please try again" }, { status: 500 });
    }

    console.log(`[SIGNUP] success - user id=${user.id} email=${user.email}`);

    return NextResponse.json(
      {
        message: "User created",
        user,
        // Returned so the SPA can log the user straight in if it wants to.
        token: signToken(user),
        nextStep: "Signup successful, please login",
      },
      { status: 201 },
    );
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      console.log(`[SIGNUP] unique constraint hit - user already exists for ${email}`);
      return NextResponse.json({ message: "User already exists" }, { status: 409 });
    }
    throw error;
  }
});

/** OPTIONS keeps CORS pre-flight from breaking local dev tooling. */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization" },
  });
}


