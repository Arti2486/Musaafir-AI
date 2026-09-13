import { hash } from "bcryptjs";
import { pool } from "./index";
import { DDL_STATEMENTS, SEED_DESTINATIONS, TEST_USER } from "./seed-data";

export type BootstrapResult = {
  ok: boolean;
  tablesCreated: boolean;
  destinations: number;
  testUserCreated: boolean;
  message: string;
};

const globalForBootstrap = globalThis as typeof globalThis & {
  __musaafirBootstrap?: Promise<BootstrapResult>;
};

/** Create every table/index the app needs. Safe to call repeatedly. */
export async function ensureTables(): Promise<void> {
  for (const statement of DDL_STATEMENTS) {
    await pool.query(statement);
  }
}

/** Upsert the destination knowledge base (idempotent - refreshes child rows). */
export async function seedDestinations(): Promise<number> {
  let count = 0;
  for (const destination of SEED_DESTINATIONS) {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO destinations
         (slug, name, state, region, category, best_time, budget_per_person, rating, image, tags, description, context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         state = EXCLUDED.state,
         region = EXCLUDED.region,
         category = EXCLUDED.category,
         best_time = EXCLUDED.best_time,
         budget_per_person = EXCLUDED.budget_per_person,
         rating = EXCLUDED.rating,
         image = EXCLUDED.image,
         tags = EXCLUDED.tags,
         description = EXCLUDED.description,
         context = EXCLUDED.context
       RETURNING id`,
      [
        destination.slug,
        destination.name,
        destination.state,
        destination.region,
        destination.category,
        destination.bestTime,
        destination.budgetPerPerson,
        destination.rating,
        destination.image,
        destination.tags,
        destination.description || destination.context.slice(0, 180) || destination.name,
        destination.context,
      ],
    );

    const destinationId = rows[0]?.id;
    if (!destinationId) continue;

    await pool.query(`DELETE FROM hotels WHERE destination_id = $1`, [destinationId]);
    await pool.query(`DELETE FROM places WHERE destination_id = $1`, [destinationId]);
    await pool.query(`DELETE FROM tips WHERE destination_id = $1`, [destinationId]);

    for (const hotel of destination.hotels ?? []) {
      await pool.query(
        `INSERT INTO hotels (destination_id, name, area, tier, price_per_night, rating, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          destinationId,
          hotel.name,
          hotel.area,
          hotel.tier,
          hotel.pricePerNight,
          hotel.rating,
          hotel.note ?? null,
        ],
      );
    }

    let order = 0;
    for (const place of destination.places ?? []) {
      await pool.query(
        `INSERT INTO places (destination_id, name, category, time_needed, entry_fee, description, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          destinationId,
          place.name,
          place.category,
          place.timeNeeded,
          place.entryFee,
          place.description,
          order++,
        ],
      );
    }

    for (const tip of destination.tips ?? []) {
      await pool.query(`INSERT INTO tips (destination_id, category, text) VALUES ($1,$2,$3)`, [
        destinationId,
        tip.category,
        tip.text,
      ]);
    }

    count += 1;
  }
  return count;
}

/** Guarantee the demo login (test@gmail.com / 123456) always exists. */
export async function ensureTestUser(): Promise<boolean> {
  const email = TEST_USER.email.toLowerCase().trim();
  const existing = await pool.query<{ id: number; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );

  if (existing.rowCount && existing.rows[0]) {
    // Repair legacy rows whose hash was never stored correctly - this is the
    // classic reason a freshly signed-up account still says "Invalid password".
    const stored = existing.rows[0].password_hash ?? "";
    if (!stored.startsWith("$2")) {
      const repaired = await hash(TEST_USER.password, 10);
      await pool.query(`UPDATE users SET password_hash = $1, name = $2 WHERE id = $3`, [
        repaired,
        TEST_USER.name,
        existing.rows[0].id,
      ]);
      console.log("[SEED] repaired the demo user's password hash");
      return true;
    }
    return false;
  }

  const passwordHash = await hash(TEST_USER.password, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)`,
    [TEST_USER.name, email, passwordHash],
  );
  console.log(`[SEED] created demo user ${email} / ${TEST_USER.password}`);
  return true;
}

/** Full bootstrap: tables -> destinations -> demo user. Never throws. */
export async function bootstrapDatabase(options?: { verbose?: boolean }): Promise<BootstrapResult> {
  const verbose = options?.verbose ?? true;
  try {
    await ensureTables();
    const destinationCount = await seedDestinations();
    const testUserCreated = await ensureTestUser();
    const result: BootstrapResult = {
      ok: true,
      tablesCreated: true,
      destinations: destinationCount,
      testUserCreated,
      message: `Database ready - ${destinationCount} destinations seeded, demo login ${TEST_USER.email} / ${TEST_USER.password}`,
    };
    if (verbose) console.log(`[BOOTSTRAP] ${result.message}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[BOOTSTRAP] PostgreSQL not connected - check DATABASE_URL.");
    console.error("[BOOTSTRAP] Detail:", message);
    return {
      ok: false,
      tablesCreated: false,
      destinations: 0,
      testUserCreated: false,
      message: `PostgreSQL not connected - ${message}`,
    };
  }
}

/**
 * Runs the bootstrap once per process and is awaited by every API route, so the
 * app works even if the operator never ran `npx drizzle-kit push` / `npm run seed`.
 */
export function ensureDatabaseReady(): Promise<BootstrapResult> {
  if (!globalForBootstrap.__musaafirBootstrap) {
    globalForBootstrap.__musaafirBootstrap = bootstrapDatabase({ verbose: true });
  }
  return globalForBootstrap.__musaafirBootstrap;
}

/** Reset the cache (used by the seed script after a fresh push). */
export function resetBootstrapCache(): void {
  delete globalForBootstrap.__musaafirBootstrap;
}
