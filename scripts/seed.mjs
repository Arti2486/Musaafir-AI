#!/usr/bin/env node
/**
 * Musaafir AI seed script  ->  `npm run seed`  (or `node scripts/seed.mjs`)
 *
 * 1. reads DATABASE_URL from .env (clear error if missing)
 * 2. creates every table + index (same DDL the Next.js app uses)
 * 3. loads the 20-destination knowledge base from src/db/seed-data.json
 * 4. guarantees the demo login: test@gmail.com / 123456 (bcrypt, 10 salt rounds)
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
const SALT_ROUNDS = 10;
const TEST_USER = { name: "Test User", email: "test@gmail.com", password: "123456" };

function fail(message, hint) {
  console.error(`\n✖ ${message}`);
  if (hint) console.error(`  ${hint}`);
  console.error("");
  process.exit(1);
}

if (!DATABASE_URL) {
  fail(
    "PostgreSQL not connected - check DATABASE_URL",
    "Step 1: cp .env.example .env  and set DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp",
  );
}

const ddl = JSON.parse(fs.readFileSync(path.join(root, "src/db/ddl.json"), "utf8"));
const destinations = JSON.parse(fs.readFileSync(path.join(root, "src/db/seed-data.json"), "utf8"));

const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 8000 });

pool.on("error", (error) => {
  console.error("[SEED] pool error:", error.message);
});

async function main() {
  console.log("── Musaafir AI seed ─────────────────────────────────────────");
  console.log(`DATABASE_URL host: ${safeHost(DATABASE_URL)}`);

  try {
    await pool.query("select 1");
  } catch (error) {
    fail(
      "PostgreSQL not connected - check DATABASE_URL",
      `Detail: ${error.message}\n  Make sure the server is running and the database exists.`,
    );
  }
  console.log("✔ PostgreSQL connected");

  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log(`✔ Tables + indexes ready (${ddl.filter((s) => s.includes("CREATE TABLE")).length} tables)`);

  let hotelCount = 0;
  let placeCount = 0;
  let tipCount = 0;

  for (const destination of destinations) {
    const { rows } = await pool.query(
      `INSERT INTO destinations
         (slug, name, state, region, category, best_time, budget_per_person, rating, image, tags, description, context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, state = EXCLUDED.state, region = EXCLUDED.region, category = EXCLUDED.category,
         best_time = EXCLUDED.best_time, budget_per_person = EXCLUDED.budget_per_person, rating = EXCLUDED.rating,
         image = EXCLUDED.image, tags = EXCLUDED.tags, description = EXCLUDED.description, context = EXCLUDED.context
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
        destination.description || destination.context?.slice(0, 180) || destination.name,
        destination.context,
      ],
    );

    const destinationId = rows[0]?.id;
    if (!destinationId) continue;

    await pool.query("DELETE FROM hotels WHERE destination_id = $1", [destinationId]);
    await pool.query("DELETE FROM places WHERE destination_id = $1", [destinationId]);
    await pool.query("DELETE FROM tips WHERE destination_id = $1", [destinationId]);

    for (const hotel of destination.hotels || []) {
      await pool.query(
        `INSERT INTO hotels (destination_id, name, area, tier, price_per_night, rating, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [destinationId, hotel.name, hotel.area, hotel.tier, hotel.pricePerNight, hotel.rating, hotel.note ?? null],
      );
      hotelCount += 1;
    }

    let order = 0;
    for (const place of destination.places || []) {
      await pool.query(
        `INSERT INTO places (destination_id, name, category, time_needed, entry_fee, description, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [destinationId, place.name, place.category, place.timeNeeded, place.entryFee, place.description, order++],
      );
      placeCount += 1;
    }

    for (const tip of destination.tips || []) {
      await pool.query("INSERT INTO tips (destination_id, category, text) VALUES ($1,$2,$3)", [
        destinationId,
        tip.category,
        tip.text,
      ]);
      tipCount += 1;
    }
  }

  console.log(
    `✔ Seeded ${destinations.length} destinations · ${placeCount} places · ${hotelCount} hotels · ${tipCount} tips`,
  );

  const email = TEST_USER.email.toLowerCase().trim();
  const existing = await pool.query("SELECT id, password_hash FROM users WHERE lower(email) = $1 LIMIT 1", [email]);

  if (existing.rowCount > 0) {
    const stored = existing.rows[0].password_hash || "";
    if (!stored.startsWith("$2")) {
      const repaired = await bcrypt.hash(TEST_USER.password, SALT_ROUNDS);
      await pool.query("UPDATE users SET password_hash = $1, name = $2 WHERE id = $3", [
        repaired,
        TEST_USER.name,
        existing.rows[0].id,
      ]);
      console.log("✔ Repaired the demo user's password hash (login will now work)");
    } else {
      console.log(`✔ Demo user already present: ${email}`);
    }
  } else {
    const passwordHash = await bcrypt.hash(TEST_USER.password, SALT_ROUNDS);
    await pool.query("INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)", [
      TEST_USER.name,
      email,
      passwordHash,
    ]);
    console.log(`✔ Created demo user ${email} / ${TEST_USER.password} (bcrypt, ${SALT_ROUNDS} salt rounds)`);
  }

  const userTotal = await pool.query("SELECT count(*)::int AS value FROM users");
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`✔ Seed complete · ${userTotal.rows[0].value} user(s) in the database`);
  console.log("");
  console.log("  Next: npm run dev");
  console.log(`  Test login: ${TEST_USER.email} / ${TEST_USER.password}`);
  console.log("");
}

function safeHost(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

main()
  .catch((error) => {
    console.error("[SEED] failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
