"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DestinationCard, DestinationCardSkeleton, type DestinationSummary } from "@/components/destination-card";
import { InfoIcon, MicIcon, SearchIcon, SparkleIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/client";
import { useVoiceInput, type VoiceMode } from "@/lib/voice";

type DestinationsResponse = {
  count: number;
  destinations: DestinationSummary[];
  knowledgeBase: { hotels: number; places: number; tips: number };
};

const SORTS = [
  { value: "name", label: "A to Z" },
  { value: "rating", label: "Top rated" },
  { value: "budget", label: "Cheapest first" },
];

export default function SearchPage() {
  const toast = useToast();
  const [all, setAll] = useState<DestinationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [region, setRegion] = useState("All");
  const [sort, setSort] = useState("rating");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("auto");

  const voice = useVoiceInput(voiceMode, (text) => {
    setQuery((current) => (current ? `${current} ${text}` : text));
    toast.success("Voice captured", `Recognised (${voice.activeLang}): "${text}"`);
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DestinationsResponse>("/api/destinations");
      setAll(data.destinations ?? []);
    } catch (error) {
      console.error("[SEARCH]", error);
      toast.error("Could not load destinations", error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(all.map((row) => row.category))).sort()],
    [all],
  );
  const regions = useMemo(() => ["All", ...Array.from(new Set(all.map((row) => row.region))).sort()], [all]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = all.filter((row) => {
      const matchesQuery =
        !needle ||
        `${row.name} ${row.state} ${row.region} ${row.category} ${row.tags} ${row.description}`
          .toLowerCase()
          .includes(needle);
      const matchesCategory = category === "All" || row.category === category;
      const matchesRegion = region === "All" || row.region === region;
      return matchesQuery && matchesCategory && matchesRegion;
    });

    if (sort === "budget") rows = [...rows].sort((a, b) => a.budgetPerPerson - b.budgetPerPerson);
    else if (sort === "name") rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    else rows = [...rows].sort((a, b) => b.rating - a.rating);

    return rows;
  }, [all, query, category, region, sort]);

  return (
    <AppShell
      title="Search destinations"
      subtitle="Filter the knowledge base by name, vibe, region or budget - then open a destination for hotels, places and tips."
      actions={
        <Link href="/planner" className="btn btn-primary !py-2">
          <SparkleIcon width={16} height={16} /> Plan a trip
        </Link>
      }
    >
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <SearchIcon
              width={17}
              height={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-200/45"
            />
            <input
              className="input !pl-11"
              placeholder="Try 'beach', 'Jyotirlinga', 'Ladakh', 'honeymoon', 'tea garden'…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              className="input !w-auto !py-2.5"
              value={voiceMode}
              onChange={(event) => setVoiceMode(event.target.value as VoiceMode)}
              aria-label="Voice language"
            >
              <option value="auto">Auto (हिन्दी + EN)</option>
              <option value="hi-IN">हिन्दी (hi-IN)</option>
              <option value="en-IN">English (en-IN)</option>
            </select>

            <button
              type="button"
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              className={`btn !px-4 !py-2.5 ${voice.listening ? "btn-primary animate-mic-pulse" : "btn-ghost"}`}
              disabled={!voice.supported}
              title={voice.supported ? "Search by voice" : "Voice input is not supported in this browser"}
            >
              <MicIcon width={17} height={17} className={voice.listening ? "text-ink-950" : "text-coral-300"} />
              {voice.listening ? "Listening…" : "Speak"}
            </button>
          </div>
        </div>

        {voice.error ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-coral-400/35 bg-coral-400/10 px-3 py-2.5 text-xs text-coral-300">
            <InfoIcon width={14} height={14} /> {voice.error}
          </p>
        ) : null}
        {voice.interim ? (
          <p className="mt-3 text-xs text-jade-300/90">
            Hearing ({voice.activeLang}): <span className="italic">{voice.interim}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`chip ${
                category === item ? "!border-saffron-400/60 !bg-saffron-400/15 !text-saffron-200" : ""
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
          <label className="flex items-center gap-2 text-xs text-sand-200/60">
            Region
            <select className="input !w-auto !py-1.5 !text-xs" value={region} onChange={(event) => setRegion(event.target.value)}>
              {regions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-sand-200/60">
            Sort
            <select className="input !w-auto !py-1.5 !text-xs" value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <span className="ml-auto text-xs text-sand-200/50">
            {loading ? "loading…" : `${results.length} of ${all.length} destinations`}
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? [0, 1, 2, 3, 4, 5, 6, 7].map((key) => <DestinationCardSkeleton key={key} />)
          : results.map((destination, index) => (
              <DestinationCard key={destination.slug} destination={destination} index={index} />
            ))}
      </section>

      {!loading && results.length === 0 ? (
        <div className="glass mt-6 rounded-3xl border-dashed p-10 text-center">
          <p className="font-display text-xl font-semibold">No destination matches “{query}”</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-sand-200/60">
            Try a broader word like “mountain”, “temple”, “beach”, or clear the filters. The knowledge base covers
            Manali, Shimla, Ujjain, Omkareshwar, Indore, Agra, Goa, Jaipur, Udaipur, Varanasi, Kedarnath, Rishikesh, Leh
            Ladakh, Darjeeling, Ooty, Mumbai, Delhi, Amritsar, Kerala and Andaman.
          </p>
          <button
            type="button"
            className="btn btn-ghost mt-5"
            onClick={() => {
              setQuery("");
              setCategory("All");
              setRegion("All");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
