import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { apiHandler, badRequest, readJson } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { loadBundles } from "@/lib/data";
import { generateItinerary, parseTripRequest } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/itinerary { prompt, slug?, days?, travellers?, budgetPerPerson?, pace?, save? }
 * Generates a day-wise plan using ONLY the destination CONTEXT (RAG, no external LLM).
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await readJson(request);

  const bundles = await loadBundles();
  if (bundles.length === 0) {
    return NextResponse.json(
      { message: "Knowledge base is empty - run `npm run seed` to load the 20 destinations" },
      { status: 503 },
    );
  }

  const tripRequest = parseTripRequest(
    {
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      slug: typeof body.slug === "string" ? body.slug : null,
      days: Number(body.days) || undefined,
      travellers: Number(body.travellers) || undefined,
      budgetPerPerson: Number(body.budgetPerPerson) || undefined,
      pace: typeof body.pace === "string" ? body.pace : undefined,
    },
    bundles,
  );

  const bundle = tripRequest.slug
    ? (bundles.find((row) => row.destination.slug === tripRequest.slug) ?? null)
    : null;

  if (!bundle) {
    return badRequest(
      `Could not detect a destination from "${tripRequest.prompt.slice(0, 60) || "your request"}". Choose one from the destination dropdown, or mention a place such as Goa / गोवा, Manali, Kerala, Kedarnath or Leh Ladakh.`,
    );
  }

  console.log(
    `[ITINERARY] prompt="${tripRequest.prompt.slice(0, 60)}" -> ${bundle.destination.slug}, ${tripRequest.days} days, ${tripRequest.travellers} travellers, budget ${tripRequest.budgetPerPerson}`,
  );

  const plan = generateItinerary(bundle, tripRequest);

  let savedTripId: number | null = null;
  if (body.save === true) {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized - please login again to save a trip" }, { status: 401 });
    }

    const [saved] = await db
      .insert(trips)
      .values({
        userId: user.id,
        destinationId: bundle.destination.id,
        destinationSlug: bundle.destination.slug,
        destinationName: bundle.destination.name,
        title: plan.title,
        days: plan.days,
        travellers: plan.travellers,
        budgetPerPerson: plan.totalPerPerson,
        startDate: typeof body.startDate === "string" ? body.startDate : null,
        pace: plan.pace,
        prompt: plan.prompt,
        itinerary: plan as unknown as Record<string, unknown>,
      })
      .returning({ id: trips.id });

    savedTripId = saved?.id ?? null;
    console.log(`[ITINERARY] saved trip id=${savedTripId} for user id=${user.id}`);
  }

  return NextResponse.json({ request: tripRequest, plan, savedTripId });
});
