"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DestinationCard, type DestinationSummary } from "@/components/destination-card";
import {
  ArrowRightIcon,
  BedIcon,
  CalendarIcon,
  CompassIcon,
  InfoIcon,
  MapPinIcon,
  RouteIcon,
  SparkleIcon,
} from "@/components/icons";
import { useToast } from "@/components/toast";
import { apiFetch, formatDate, getStoredUser } from "@/lib/client";

type HealthResponse = {
  ok: boolean;
  database: { connected: boolean; message: string; users: number; destinations: number };
  env: { ok: boolean; issues: string[]; jwtSecretSource: string };
};

type TripsResponse = { count: number; trips: { id: number; title: string; destinationName: string; days: number; createdAt: string; itinerary: unknown }[] };
type DestinationsResponse = { count: number; destinations: DestinationSummary[]; knowledgeBase: { hotels: number; places: number; tips: number } };

const QUICK_PROMPTS = [
  "3 दिन का मनाली ट्रिप, 2 लोग, budget में",
  "Weekend trip to Udaipur for a couple",
  "5 days in Leh Ladakh with bikes",
  "Kedarnath yatra plan for 4 people",
];

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();

  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [knowledge, setKnowledge] = useState({ hotels: 0, places: 0, tips: 0 });
  const [trips, setTrips] = useState<TripsResponse["trips"]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");

  const user = getStoredUser();
  const firstName = user?.name?.split(" ")[0] ?? "traveller";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [destinationData, tripData, healthData] = await Promise.all([
        apiFetch<DestinationsResponse>("/api/destinations?sort=rating"),
        apiFetch<TripsResponse>("/api/trips").catch(() => ({ count: 0, trips: [] }) as TripsResponse),
        fetch("/api/health").then((response) => response.json() as Promise<HealthResponse>).catch(() => null),
      ]);

      setDestinations(destinationData.destinations ?? []);
      setKnowledge(destinationData.knowledgeBase ?? { hotels: 0, places: 0, tips: 0 });
      setTrips(tripData.trips ?? []);
      setHealth(healthData);

      if (healthData && !healthData.database.connected) {
        toast.error("PostgreSQL not connected", healthData.database.message);
      }
    } catch (error) {
      console.error("[DASHBOARD]", error);
      toast.error("Could not load your dashboard", error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function startPlanning() {
    router.push(prompt.trim() ? `/planner?prompt=${encodeURIComponent(prompt.trim())}` : "/planner");
  }

  const stats = [
    { label: "Destinations", value: destinations.length || "—", icon: MapPinIcon, tint: "text-saffron-300" },
    { label: "Places in CONTEXT", value: knowledge.places || "—", icon: CompassIcon, tint: "text-jade-300" },
    { label: "Stay options", value: knowledge.hotels || "—", icon: BedIcon, tint: "text-coral-300" },
    { label: "Saved trips", value: trips.length, icon: RouteIcon, tint: "text-saffron-300" },
  ];

  return (
    <AppShell
      title={`${greeting}, ${firstName}`}
      subtitle="Here is your travel desk - knowledge base status, quick planning and recent trips."
      actions={
        <>
          <Link href="/search" className="btn btn-ghost !py-2">
            Search destinations
          </Link>
          <Link href="/planner" className="btn btn-primary !py-2">
            <SparkleIcon width={16} height={16} /> New itinerary
          </Link>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* quick planner */}
        <section className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-saffron-400/12 blur-3xl"
          />
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-saffron-300/85">AI itinerary generator</p>
          <h2 className="mt-2 font-display text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-tight">
            Describe the trip. We will build the days.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-sand-200/65">
            Type or speak in Hindi or English - destination, number of days, travellers and budget are all understood
            from a single sentence.
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <input
              className="input flex-1"
              placeholder="4 दिन का गोवा ट्रिप, 4 लोग, 15000 budget"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") startPlanning();
              }}
            />
            <button type="button" className="btn btn-primary shrink-0" onClick={startPlanning}>
              Generate <ArrowRightIcon width={16} height={16} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((quick) => (
              <button key={quick} type="button" className="chip" onClick={() => setPrompt(quick)}>
                {quick}
              </button>
            ))}
          </div>
        </section>

        {/* system status */}
        <section className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">System status</h3>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                health?.database.connected
                  ? "bg-jade-400/15 text-jade-300"
                  : "bg-coral-400/15 text-coral-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${health?.database.connected ? "bg-jade-300" : "bg-coral-400"}`} />
              {health ? (health.database.connected ? "DB connected" : "DB offline") : "checking…"}
            </span>
          </div>

          <dl className="mt-4 grid gap-2.5 text-xs">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3 py-2.5">
              <dt className="text-sand-200/60">PostgreSQL</dt>
              <dd className="truncate text-right font-medium text-sand-100">{health?.database.message ?? "…"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3 py-2.5">
              <dt className="text-sand-200/60">JWT secret</dt>
              <dd className="font-medium text-sand-100">
                {health?.env.jwtSecretSource === "env" ? "from .env" : "dev fallback"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3 py-2.5">
              <dt className="text-sand-200/60">Registered users</dt>
              <dd className="font-medium text-sand-100">{health?.database.users ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3 py-2.5">
              <dt className="text-sand-200/60">Local tips</dt>
              <dd className="font-medium text-sand-100">{knowledge.tips || "—"}</dd>
            </div>
          </dl>

          {health && health.env.issues.length > 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-coral-400/35 bg-coral-400/10 px-3 py-2.5 text-[0.7rem] leading-relaxed text-coral-300">
              <InfoIcon width={14} height={14} className="mt-px shrink-0" />
              {health.env.issues[0]}
            </p>
          ) : null}
        </section>
      </div>

      {/* stats */}
      <section className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-lift glass rounded-2xl p-4.5 px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-sand-200/55">{stat.label}</p>
              <stat.icon width={16} height={16} className={stat.tint} />
            </div>
            <p className="mt-2 font-display text-3xl font-semibold text-sand-100">
              {loading ? <span className="skeleton inline-block h-8 w-14 rounded-lg align-middle" /> : stat.value}
            </p>
          </div>
        ))}
      </section>

      {/* recent trips */}
      <section className="mt-9">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">Recent trips</h2>
          <Link href="/trips" className="text-xs font-semibold text-saffron-300 underline-offset-4 hover:underline">
            View all history
          </Link>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="glass rounded-2xl p-4">
                <div className="skeleton h-3.5 w-2/3 rounded-full" />
                <div className="skeleton mt-2.5 h-3 w-1/3 rounded-full" />
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="mt-4 glass rounded-2xl border-dashed p-8 text-center">
            <p className="font-display text-lg font-semibold text-sand-100">No trips saved yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-sand-200/60">
              Generate an itinerary in the AI Planner and press <span className="text-saffron-300">Save to My Trips</span>{" "}
              to keep it here with full day-wise detail and a PDF export.
            </p>
            <Link href="/planner" className="btn btn-primary mt-5">
              <SparkleIcon width={16} height={16} /> Plan your first trip
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trips.slice(0, 3).map((trip) => (
              <Link
                key={trip.id}
                href={`/trips?open=${trip.id}`}
                className="card-lift glass rounded-2xl p-4.5 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-base font-semibold leading-tight">{trip.title}</p>
                  <span className="shrink-0 rounded-full bg-saffron-400/12 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-saffron-300">
                    {trip.days} days
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-sand-200/60">
                  <CalendarIcon width={13} height={13} /> {formatDate(trip.createdAt)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-jade-300/80">
                  <MapPinIcon width={13} height={13} /> {trip.destinationName}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* destinations */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Top rated right now</h2>
            <p className="mt-1 text-xs text-sand-200/55">
              Typical per-person budgets from the knowledge base · tap a card for hotels, places and tips
            </p>
          </div>
          <Link href="/search" className="btn btn-ghost !py-2">
            Explore all {destinations.length || 20}
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? [0, 1, 2, 3].map((key) => (
                <div key={key} className="glass overflow-hidden rounded-2xl">
                  <div className="skeleton h-44 w-full" />
                  <div className="space-y-2.5 p-4">
                    <div className="skeleton h-3 w-3/4 rounded-full" />
                    <div className="skeleton h-3 w-1/2 rounded-full" />
                  </div>
                </div>
              ))
            : destinations.slice(0, 8).map((destination, index) => (
                <DestinationCard key={destination.slug} destination={destination} index={index} />
              ))}
        </div>

        {!loading && destinations.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl border border-coral-400/35 bg-coral-400/10 px-4 py-3 text-xs text-coral-300">
            <InfoIcon width={15} height={15} /> No destinations found. Run <code className="mx-1">npm run seed</code> or
            restart the server so Musaafir can provision its knowledge base.
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
