import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/bootstrap";
import { trips } from "@/db/schema";
import { apiHandler, badRequest, readJson } from "@/lib/api";
import { requireAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/trips -> the signed-in user's saved itineraries (My Trips history). */
export const GET = apiHandler(async (request: NextRequest) => {
  const user = await requireAuthUser(request);
  await ensureDatabaseReady();

  const rows = await db
    .select()
    .from(trips)
    .where(eq(trips.userId, user.id))
    .orderBy(desc(trips.createdAt));

  return NextResponse.json({ count: rows.length, trips: rows });
});

/** POST /api/trips -> save a generated plan. */
export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireAuthUser(request);
  await ensureDatabaseReady();

  const body = await readJson(request);
  const plan = body.plan as Record<string, unknown> | undefined;

  if (!plan || typeof plan !== "object") return badRequest("A generated itinerary `plan` object is required");

  const destinationName = String(plan.destinationName ?? "Trip");
  const [saved] = await db
    .insert(trips)
    .values({
      userId: user.id,
      destinationId: typeof plan.destinationId === "number" ? plan.destinationId : null,
      destinationSlug: typeof plan.destinationSlug === "string" ? plan.destinationSlug : null,
      destinationName,
      title: String(plan.title ?? `${destinationName} trip`),
      days: Number(plan.days) || 3,
      travellers: Number(plan.travellers) || 2,
      budgetPerPerson: Number(plan.totalPerPerson ?? plan.budgetPerPerson) || 0,
      startDate: typeof body.startDate === "string" ? body.startDate : null,
      pace: String(plan.pace ?? "balanced"),
      prompt: typeof plan.prompt === "string" ? plan.prompt : null,
      itinerary: plan,
    })
    .returning();

  console.log(`[TRIPS] saved id=${saved.id} "${saved.title}" for user id=${user.id}`);
  return NextResponse.json({ message: "Trip saved", trip: saved }, { status: 201 });
});
