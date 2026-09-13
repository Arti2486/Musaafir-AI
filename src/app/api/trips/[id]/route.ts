import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { apiHandler } from "@/lib/api";
import { requireAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function findOwnedTrip(request: NextRequest, id: string) {
  const user = await requireAuthUser(request);
  const tripId = Number(id);
  if (!Number.isFinite(tripId) || tripId <= 0) return { user, trip: null, invalid: true as const };

  const rows = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)))
    .limit(1);

  return { user, trip: rows[0] ?? null, invalid: false as const };
}

/** GET /api/trips/[id] */
export const GET = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const { trip, invalid } = await findOwnedTrip(request, id);
  if (invalid) return NextResponse.json({ message: "Invalid trip id" }, { status: 400 });
  if (!trip) return NextResponse.json({ message: "Trip not found" }, { status: 404 });
  return NextResponse.json({ trip });
});

/** DELETE /api/trips/[id] */
export const DELETE = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const { trip, invalid } = await findOwnedTrip(request, id);
  if (invalid) return NextResponse.json({ message: "Invalid trip id" }, { status: 400 });
  if (!trip) return NextResponse.json({ message: "Trip not found" }, { status: 404 });

  await db.delete(trips).where(eq(trips.id, trip.id));
  console.log(`[TRIPS] deleted id=${trip.id}`);
  return NextResponse.json({ message: "Trip deleted", id: trip.id });
});
