"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  BedIcon,
  ClockIcon,
  CompassIcon,
  InfoIcon,
  MapPinIcon,
  RupeeIcon,
  SparkleIcon,
  StarIcon,
} from "@/components/icons";
import { useToast } from "@/components/toast";
import { apiFetch, formatINR } from "@/lib/client";

type Hotel = { id: number; name: string; area: string; tier: string; pricePerNight: number; rating: number; note: string | null };
type Place = { id: number; name: string; category: string; timeNeeded: string; entryFee: string; description: string };
type Tip = { id: number; category: string; text: string };
type Destination = {
  slug: string;
  name: string;
  state: string;
  region: string;
  category: string;
  bestTime: string;
  budgetPerPerson: number;
  rating: number;
  image: string | null;
  tags: string;
  description: string;
  context: string;
};
type Related = { slug: string; name: string; state: string; category: string; image: string | null; rating: number; budgetPerPerson: number };

type DetailResponse = { destination: Destination; hotels: Hotel[]; places: Place[]; tips: Tip[]; context: string; related: Related[] };

export default function DestinationDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<DetailResponse>(`/api/destinations/${encodeURIComponent(slug)}`);
      setData(response);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Could not load this destination";
      setError(message);
      toast.error("Destination unavailable", message);
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AppShell title="Loading destination…" subtitle="Fetching hotels, places and tips from the knowledge base.">
        <div className="glass h-64 w-full animate-pulse rounded-3xl" />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="glass h-40 rounded-2xl p-4">
              <div className="skeleton h-3 w-2/3 rounded-full" />
              <div className="skeleton mt-3 h-3 w-1/2 rounded-full" />
              <div className="skeleton mt-3 h-3 w-4/5 rounded-full" />
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Destination not found" subtitle="That place is not in the Musaafir knowledge base yet.">
        <div className="glass rounded-3xl p-8 text-center">
          <p className="text-sm text-sand-200/70">{error ?? "Unknown error"}</p>
          <Link href="/search" className="btn btn-primary mt-5">
            Back to search
          </Link>
        </div>
      </AppShell>
    );
  }

  const { destination, hotels, places, tips, related } = data;
  const cheapest = hotels.length ? Math.min(...hotels.map((hotel) => hotel.pricePerNight)) : destination.budgetPerPerson / 4;

  return (
    <AppShell
      title={destination.name}
      subtitle={`${destination.state} · ${destination.region} · best time ${destination.bestTime}`}
      actions={
        <>
          <button type="button" className="btn btn-ghost !py-2" onClick={() => router.back()}>
            Back
          </button>
          <Link href={`/planner?slug=${destination.slug}`} className="btn btn-primary !py-2">
            <SparkleIcon width={16} height={16} /> Plan this trip
          </Link>
        </>
      }
    >
      {/* hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/8">
        <div className="h-72 w-full sm:h-80">
          {destination.image ? (
            <img src={destination.image} alt={destination.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-ink-700 to-ink-900" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <span className="rounded-full bg-saffron-400/15 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-saffron-200 ring-1 ring-inset ring-saffron-400/30">
            {destination.category}
          </span>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-sand-200/85">{destination.description}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-sand-100">
              <StarIcon width={14} height={14} className="text-saffron-400" /> {destination.rating.toFixed(1)} rating
            </span>
            <span className="flex items-center gap-1.5 text-sand-100">
              <RupeeIcon width={14} height={14} className="text-jade-300" /> {formatINR(destination.budgetPerPerson)} typical
            </span>
            <span className="flex items-center gap-1.5 text-sand-100">
              <BedIcon width={14} height={14} className="text-coral-300" /> stays from {formatINR(cheapest)} / night
            </span>
            <span className="flex items-center gap-1.5 text-sand-100">
              <MapPinIcon width={14} height={14} className="text-saffron-300" /> {places.length} places · {tips.length} tips
            </span>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* places */}
        <section>
          <h2 className="font-display text-xl font-semibold">Places to cover</h2>
          <div className="mt-4 grid gap-3">
            {places.map((place, index) => (
              <article
                key={place.id}
                className="card-lift glass flex gap-4 rounded-2xl p-4 animate-fade-up"
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron-400/12 font-display text-sm font-semibold text-saffron-300 ring-1 ring-inset ring-saffron-400/25">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold leading-tight">{place.name}</h3>
                    <span className="rounded-full bg-white/6 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-jade-300">
                      {place.category}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-sand-200/70">{place.description}</p>
                  <p className="mt-2 flex flex-wrap gap-3 text-[0.7rem] text-sand-200/55">
                    <span className="flex items-center gap-1">
                      <ClockIcon width={12} height={12} /> {place.timeNeeded}
                    </span>
                    <span className="flex items-center gap-1">
                      <RupeeIcon width={12} height={12} /> {place.entryFee}
                    </span>
                  </p>
                </div>
              </article>
            ))}
          </div>

          <h2 className="mt-8 font-display text-xl font-semibold">Hotels & stays</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {hotels.map((hotel) => (
              <article key={hotel.id} className="card-lift glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold leading-tight">{hotel.name}</h3>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/6 px-2 py-0.5 text-[0.68rem] font-semibold text-saffron-200">
                    <StarIcon width={11} height={11} /> {hotel.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-sand-200/60">{hotel.area}</p>
                {hotel.note ? <p className="mt-2 text-xs leading-relaxed text-sand-200/70">{hotel.note}</p> : null}
                <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
                  <span className="text-[0.68rem] uppercase tracking-wide text-sand-200/50">{hotel.tier}</span>
                  <span className="font-display text-base font-semibold text-jade-300">
                    {formatINR(hotel.pricePerNight)}
                    <span className="text-[0.68rem] font-normal text-sand-200/50"> / night</span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* sidebar */}
        <aside className="grid gap-5">
          <section className="glass rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <InfoIcon width={17} height={17} className="text-saffron-300" /> Local tips
            </h2>
            <ul className="mt-3.5 grid gap-3">
              {tips.map((tip) => (
                <li key={tip.id} className="rounded-2xl bg-white/4 p-3.5">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-coral-300">{tip.category}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-sand-200/80">{tip.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <CompassIcon width={17} height={17} className="text-jade-300" /> CONTEXT used by the AI
            </h2>
            <p className="mt-2 text-[0.7rem] uppercase tracking-wide text-sand-200/45">
              This exact text is what the itinerary generator retrieves from - nothing else.
            </p>
            <p className="mt-3 max-h-64 overflow-y-auto rounded-2xl bg-ink-950/50 p-3.5 text-xs leading-relaxed text-sand-200/75">
              {destination.context}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {destination.tags.split(",").slice(0, 8).map((tag) => (
                <span key={tag} className="chip !px-2 !py-0.5 !text-[0.65rem]">
                  #{tag.trim()}
                </span>
              ))}
            </div>
          </section>

          {related.length ? (
            <section className="glass rounded-3xl p-5">
              <h2 className="font-display text-lg font-semibold">Similar destinations</h2>
              <div className="mt-3 grid gap-2.5">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/destinations/${item.slug}`}
                    className="group flex items-center gap-3 rounded-2xl bg-white/4 p-2.5 transition hover:bg-white/8"
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-11 w-14 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="h-11 w-14 rounded-xl bg-ink-700" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-sand-100 group-hover:text-saffron-200">
                        {item.name}
                      </span>
                      <span className="block truncate text-[0.7rem] text-sand-200/55">
                        {item.state} · {formatINR(item.budgetPerPerson)}
                      </span>
                    </span>
                    <StarIcon width={13} height={13} className="shrink-0 text-saffron-400" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
