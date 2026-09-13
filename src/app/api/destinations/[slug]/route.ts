import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api";
import { loadBundleBySlug, loadBundles } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/** GET /api/destinations/[slug] -> full knowledge bundle (hotels, places, tips, context). */
export const GET = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { slug } = await context.params;
  const bundle = await loadBundleBySlug(slug);

  if (!bundle) {
    return NextResponse.json({ message: `Destination "${slug}" not found` }, { status: 404 });
  }

  // Related destinations in the same region/category for the detail page.
  const all = await loadBundles();
  const related = all
    .filter((row) => row.destination.slug !== bundle.destination.slug)
    .map((row) => ({
      slug: row.destination.slug,
      name: row.destination.name,
      state: row.destination.state,
      category: row.destination.category,
      image: row.destination.image,
      rating: row.destination.rating,
      budgetPerPerson: row.destination.budgetPerPerson,
      score:
        (row.destination.region === bundle.destination.region ? 2 : 0) +
        (row.destination.category === bundle.destination.category ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _score, ...rest }) => rest);

  return NextResponse.json({
    destination: bundle.destination,
    hotels: bundle.hotels,
    places: bundle.places,
    tips: bundle.tips,
    context: bundle.destination.context,
    related,
  });
});
