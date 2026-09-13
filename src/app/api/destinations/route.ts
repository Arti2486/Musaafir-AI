import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { hotels, places, tips } from "@/db/schema";
import { apiHandler } from "@/lib/api";
import { loadBundles } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/destinations?q=&category=&region=&sort=
 * Public catalogue with per-destination counts.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const region = params.get("region") ?? "";
  const sort = params.get("sort") ?? "name";

  const bundles = await loadBundles(null, q);

  let results = bundles.map((bundle) => ({
    ...bundle.destination,
    hotelCount: bundle.hotels.length,
    placeCount: bundle.places.length,
    tipCount: bundle.tips.length,
    priceFrom: Math.min(...bundle.hotels.map((hotel) => hotel.pricePerNight), 99999),
  }));

  if (category) {
    const needle = category.toLowerCase();
    results = results.filter(
      (row) =>
        row.category.toLowerCase() === needle ||
        row.tags.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle),
    );
  }
  if (region) {
    const needle = region.toLowerCase();
    results = results.filter((row) => row.region.toLowerCase().includes(needle));
  }

  if (sort === "budget") results.sort((a, b) => a.budgetPerPerson - b.budgetPerPerson);
  else if (sort === "rating") results.sort((a, b) => b.rating - a.rating);
  else results.sort((a, b) => a.name.localeCompare(b.name));

  const [hotelTotal, placeTotal, tipTotal] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(hotels),
    db.select({ value: sql<number>`count(*)::int` }).from(places),
    db.select({ value: sql<number>`count(*)::int` }).from(tips),
  ]);

  return NextResponse.json({
    count: results.length,
    destinations: results,
    knowledgeBase: {
      hotels: hotelTotal[0]?.value ?? 0,
      places: placeTotal[0]?.value ?? 0,
      tips: tipTotal[0]?.value ?? 0,
    },
  });
});
