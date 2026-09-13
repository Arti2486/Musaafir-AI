import { asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/bootstrap";
import { destinations, hotels, places, tips } from "@/db/schema";
import type { Bundle } from "@/lib/rag";

/** Loads the destination knowledge base, auto-provisioning tables + seed data first. */
export async function loadBundles(slug?: string | null, search?: string | null): Promise<Bundle[]> {
  await ensureDatabaseReady();

  const conditions = [];
  if (slug) conditions.push(eq(destinations.slug, slug));
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(destinations.name, term),
        ilike(destinations.state, term),
        ilike(destinations.category, term),
        ilike(destinations.region, term),
        ilike(destinations.tags, term),
        ilike(destinations.description, term),
      ),
    );
  }

  const rows = await db
    .select()
    .from(destinations)
    .where(conditions.length ? sql.join(conditions, sql` AND `) : sql`1=1`)
    .orderBy(asc(destinations.name));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const [hotelRows, placeRows, tipRows] = await Promise.all([
    db.select().from(hotels).where(inArray(hotels.destinationId, ids)).orderBy(asc(hotels.pricePerNight)),
    db
      .select()
      .from(places)
      .where(inArray(places.destinationId, ids))
      .orderBy(asc(places.destinationId), asc(places.sortOrder)),
    db.select().from(tips).where(inArray(tips.destinationId, ids)).orderBy(asc(tips.destinationId), asc(tips.id)),
  ]);

  return rows.map((destination) => ({
    destination,
    hotels: hotelRows.filter((hotel) => hotel.destinationId === destination.id),
    places: placeRows.filter((place) => place.destinationId === destination.id),
    tips: tipRows.filter((tip) => tip.destinationId === destination.id),
  }));
}

export async function loadBundleBySlug(slug: string): Promise<Bundle | null> {
  const bundles = await loadBundles(slug);
  return bundles[0] ?? null;
}
