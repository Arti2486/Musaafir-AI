import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Never throw at import time: a missing `.env` should produce a readable
 * diagnostic instead of taking the whole server down.
 */
export const DATABASE_URL = process.env.DATABASE_URL?.trim();

export const DB_FALLBACK_URL = "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

let warnedMissingUrl = false;

function warnMissingUrl() {
  if (warnedMissingUrl) return;
  warnedMissingUrl = true;
  console.error(
    "\n[DB] PostgreSQL not connected - check DATABASE_URL\n" +
      "[DB] .env is missing DATABASE_URL. Copy .env.example to .env and set:\n" +
      "[DB]   DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp\n" +
      "[DB] Falling back to " +
      DB_FALLBACK_URL +
      " so the server keeps running.\n",
  );
}

if (!DATABASE_URL) warnMissingUrl();

const globalForDb = globalThis as typeof globalThis & {
  __musaafirPool?: Pool;
  __musaafirDb?: ReturnType<typeof buildDb>;
};

function buildPool() {
  return new Pool({
    connectionString: DATABASE_URL || DB_FALLBACK_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    // Keep errors from crashing the process when nothing is listening yet.
    allowExitOnIdle: true,
  });
}

function buildDb(pool: Pool) {
  return drizzle(pool, { schema, logger: false });
}

export const pool: Pool = globalForDb.__musaafirPool ?? buildPool();
if (!globalForDb.__musaafirPool) globalForDb.__musaafirPool = pool;

export const db = globalForDb.__musaafirDb ?? buildDb(pool);
if (!globalForDb.__musaafirDb) globalForDb.__musaafirDb = db;

pool.on("error", (err) => {
  console.error("[DB] idle client error - PostgreSQL may be unreachable:", err.message);
});

/** Human readable connection state, used by /api/health and the dashboard. */
export async function checkDbConnection(): Promise<{
  ok: boolean;
  message: string;
  urlConfigured: boolean;
}> {
  if (!DATABASE_URL) {
    return {
      ok: false,
      urlConfigured: false,
      message:
        "DATABASE_URL is not set. Copy .env.example to .env and set DATABASE_URL=postgresql://user:password@localhost:5432/dbname",
    };
  }
  try {
    const client = await pool.connect();
    try {
      await client.query("select 1");
      return { ok: true, urlConfigured: true, message: "PostgreSQL connected" };
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[DB] PostgreSQL not connected - check DATABASE_URL:", message);
    return { ok: false, urlConfigured: true, message: `PostgreSQL not connected - ${message}` };
  }
}
