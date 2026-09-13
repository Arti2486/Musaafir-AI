import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkDbConnection, db, DATABASE_URL } from "@/db";
import { ensureDatabaseReady } from "@/db/bootstrap";
import { destinations, users } from "@/db/schema";
import { getEnvStatus } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health -> DB connectivity + env diagnostics.
 * Returns 200 whenever PostgreSQL is reachable (it also self-provisions tables
 * and the demo user), and 503 with an actionable message when it is not.
 */
export async function GET() {
  const env = getEnvStatus();
  const connection = await checkDbConnection();

  if (!connection.ok) {
    return NextResponse.json(
      {
        ok: false,
        app: "Musaafir AI",
        database: { connected: false, urlConfigured: Boolean(DATABASE_URL), message: connection.message, users: 0, destinations: 0 },
        env,
        demoLogin: { email: "test@gmail.com", password: "123456" },
        hint: "PostgreSQL not connected - check DATABASE_URL. Fix .env, then: npx drizzle-kit push && npm run seed",
      },
      { status: 503 },
    );
  }

  // Idempotent: creates tables, seeds the knowledge base, guarantees the demo login.
  const bootstrap = await ensureDatabaseReady();

  let userCount = 0;
  let destinationCount = 0;
  try {
    const [u, d] = await Promise.all([
      db.select({ value: sql<number>`count(*)::int` }).from(users),
      db.select({ value: sql<number>`count(*)::int` }).from(destinations),
    ]);
    userCount = u[0]?.value ?? 0;
    destinationCount = d[0]?.value ?? 0;
  } catch (error) {
    console.error("[HEALTH] count query failed:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    ok: true,
    app: "Musaafir AI",
    database: {
      connected: true,
      urlConfigured: Boolean(DATABASE_URL),
      message: connection.message,
      users: userCount,
      destinations: destinationCount,
    },
    bootstrap: { ok: bootstrap.ok, destinations: bootstrap.destinations, testUserCreated: bootstrap.testUserCreated },
    env,
    demoLogin: { email: "test@gmail.com", password: "123456" },
    hint: userCount === 0 ? "Run: npm run seed" : null,
  });
}
