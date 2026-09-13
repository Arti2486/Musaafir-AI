"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { DestinationSummary } from "@/components/destination-card";
import {
  AlertIcon,
  BedIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CompassIcon,
  DownloadIcon,
  InfoIcon,
  MicIcon,
  RouteIcon,
  RupeeIcon,
  SparkleIcon,
  StarIcon,
} from "@/components/icons";
import { useToast } from "@/components/toast";
import { apiFetch, formatINR, getStoredUser } from "@/lib/client";
import { downloadItineraryPdf } from "@/lib/pdf";
import type { ItineraryPlan } from "@/lib/rag";
import { useVoiceInput, type VoiceMode } from "@/lib/voice";

type GenerateResponse = {
  request: { prompt: string; slug: string | null; days: number; travellers: number; budgetPerPerson: number; pace: string; interests: string[] };
  plan: ItineraryPlan;
  savedTripId: number | null;
};

const PACES = [
  { value: "relaxed", label: "Relaxed", hint: "2 sights / day" },
  { value: "balanced", label: "Balanced", hint: "3 sights / day" },
  { value: "packed", label: "Packed", hint: "4 sights / day" },
];

const BUDGET_PRESETS = [
  { value: 8000, label: "Backpacker" },
  { value: 14000, label: "Comfort" },
  { value: 25000, label: "Premium" },
  { value: 45000, label: "Luxury" },
];

const EXAMPLES = [
  "3 दिन का मनाली ट्रिप, 2 लोग, budget में",
  "Plan 5 days in Kerala with a houseboat for a couple",
  "Weekend in Amritsar, 2 days, 3 people",
  "7 days Leh Ladakh bike trip, budget 30000",
];

function PlannerInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const user = getStoredUser();

  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [prompt, setPrompt] = useState("");
  const [slug, setSlug] = useState<string>("");
  const [days, setDays] = useState(3);
  const [travellers, setTravellers] = useState(2);
  const [budget, setBudget] = useState(14000);
  const [pace, setPace] = useState("balanced");
  const [startDate, setStartDate] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("auto");

  const [plan, setPlan] = useState<ItineraryPlan | null>(null);
  const [parsed, setParsed] = useState<GenerateResponse["request"] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTripId, setSavedTripId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceInput(voiceMode, (text) => {
    setPrompt((current) => (current ? `${current} ${text}` : text));
    toast.success("Voice recognised", `${text} (${voice.activeLang})`);
  });

  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    const slugParam = searchParams.get("slug");
    if (promptParam) setPrompt(promptParam);
    if (slugParam) setSlug(slugParam);
  }, [searchParams]);

  useEffect(() => {
    apiFetch<{ destinations: DestinationSummary[] }>("/api/destinations")
      .then((data) => setDestinations(data.destinations ?? []))
      .catch((loadError) => {
        console.error("[PLANNER]", loadError);
        toast.error("Could not load destinations", loadError instanceof Error ? loadError.message : undefined);
      });
  }, [toast]);

  const selected = useMemo(
    () => destinations.find((destination) => destination.slug === slug) ?? null,
    [destinations, slug],
  );

  const generate = useCallback(
    async (options?: { save?: boolean }) => {
      setGenerating(true);
      setError(null);
      try {
        const data = await apiFetch<GenerateResponse>("/api/itinerary", {
          method: "POST",
          body: {
            prompt,
            slug: slug || undefined,
            days,
            travellers,
            budgetPerPerson: budget,
            pace,
            startDate: startDate || undefined,
            save: options?.save ?? false,
          },
        });

        setPlan(data.plan);
        setParsed(data.request);
        setSlug(data.plan.destinationSlug);
        setDays(data.plan.days);
        setTravellers(data.plan.travellers);
        setBudget(data.request.budgetPerPerson);
        setPace(data.plan.pace);
        if (data.savedTripId) {
          setSavedTripId(data.savedTripId);
          toast.success("Trip saved", "Find it under My Trips.");
        } else {
          toast.success("Itinerary ready", `${data.plan.title} generated from the CONTEXT knowledge base.`);
        }
      } catch (generateError) {
        const message = generateError instanceof Error ? generateError.message : "Generation failed";
        setError(message);
        toast.error("Could not generate the itinerary", message);
      } finally {
        setGenerating(false);
      }
    },
    [budget, days, pace, prompt, slug, startDate, toast, travellers],
  );

  const saveTrip = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const data = await apiFetch<{ trip: { id: number } }>("/api/trips", {
        method: "POST",
        body: { plan, startDate: startDate || undefined },
      });
      setSavedTripId(data.trip.id);
      toast.success("Saved to My Trips", "Open My Trips to re-download the PDF any time.");
    } catch (saveError) {
      toast.error("Save failed", saveError instanceof Error ? saveError.message : undefined);
    } finally {
      setSaving(false);
    }
  }, [plan, startDate, toast]);

  const exportPdf = useCallback(async () => {
    if (!plan) return;
    setExporting(true);
    try {
      const fileName = await downloadItineraryPdf(plan, user?.name ?? null);
      toast.success("PDF downloaded", fileName);
    } catch (pdfError) {
      console.error("[PDF]", pdfError);
      toast.error("PDF export failed", pdfError instanceof Error ? pdfError.message : undefined);
    } finally {
      setExporting(false);
    }
  }, [plan, toast, user?.name]);

  return (
    <AppShell
      title="AI itinerary generator"
      subtitle="Speak or type your trip - the plan is retrieved and assembled only from the destination CONTEXT, hotels, places and tips tables."
      actions={
        plan ? (
          <>
            <button type="button" className="btn btn-ghost !py-2" onClick={() => void generate()}>
              <SparkleIcon width={16} height={16} /> Regenerate
            </button>
            <button type="button" className="btn btn-ghost !py-2" onClick={() => void exportPdf()} disabled={exporting}>
              <DownloadIcon width={16} height={16} /> {exporting ? "Building…" : "Download PDF"}
            </button>
            <button
              type="button"
              className="btn btn-primary !py-2"
              onClick={() => void saveTrip()}
              disabled={saving || Boolean(savedTripId)}
            >
              {savedTripId ? <CheckIcon width={16} height={16} /> : <RouteIcon width={16} height={16} />}
              {savedTripId ? "Saved" : saving ? "Saving…" : "Save to My Trips"}
            </button>
          </>
        ) : null
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* controls */}
        <section className="glass h-fit rounded-3xl p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold">Trip request</h2>

          <label className="label mt-4" htmlFor="prompt">
            Describe your trip
          </label>
          <textarea
            id="prompt"
            className="input min-h-[7.5rem] resize-y"
            placeholder="4 दिन का गोवा ट्रिप, 2 लोग, 15000 budget, beach और food चाहिए"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="input !w-auto !py-2 !text-xs"
              value={voiceMode}
              onChange={(event) => setVoiceMode(event.target.value as VoiceMode)}
              aria-label="Voice language"
            >
              <option value="auto">Auto detect (हिन्दी + EN)</option>
              <option value="hi-IN">हिन्दी (hi-IN)</option>
              <option value="en-IN">English (en-IN)</option>
            </select>

            <button
              type="button"
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              disabled={!voice.supported}
              className={`btn !px-3.5 !py-2 !text-xs ${voice.listening ? "btn-primary animate-mic-pulse" : "btn-ghost"}`}
              title={voice.supported ? "Dictate your trip" : "Web Speech API is not available in this browser"}
            >
              <MicIcon width={15} height={15} className={voice.listening ? "text-ink-950" : "text-coral-300"} />
              {voice.listening ? `Listening · ${voice.activeLang}` : "Voice input"}
            </button>
          </div>

          {!voice.supported ? (
            <p className="mt-2.5 flex items-start gap-2 rounded-xl border border-saffron-400/30 bg-saffron-400/8 px-3 py-2 text-[0.7rem] leading-relaxed text-saffron-200">
              <InfoIcon width={13} height={13} className="mt-px shrink-0" />
              Voice input needs Chrome, Edge or Safari. You can still type your request.
            </p>
          ) : null}
          {voice.error ? (
            <p className="mt-2.5 flex items-start gap-2 rounded-xl border border-coral-400/35 bg-coral-400/10 px-3 py-2 text-[0.7rem] leading-relaxed text-coral-300">
              <AlertIcon width={13} height={13} className="mt-px shrink-0" /> {voice.error}
            </p>
          ) : null}
          {voice.interim ? (
            <p className="mt-2.5 text-[0.7rem] text-jade-300">
              hearing ({voice.activeLang}): <span className="italic">{voice.interim}</span>
            </p>
          ) : null}

          <label className="label mt-5" htmlFor="destination">
            Destination
          </label>
          <select
            id="destination"
           className="input !bg-[#192028] !text-white border border-white/20"
           style={{ colorScheme: "dark", backgroundColor: "#192028", color: "white" }}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          >
            <option value="" style={{ backgroundColor: "#192028", color: "white" }}>Auto-detect from my text</option>
            {destinations.map((destination, idx) => (
  <option key={destination.slug} value={destination.slug} style={{ backgroundColor: "#192028", color: "white" }}>
              {destination.name} · {destination.state}
            </option>
          ))}
          </select>
          {selected ? (
            <p className="mt-2 text-[0.7rem] text-sand-200/55">
              {selected.category} · best time {selected.bestTime} · from {formatINR(selected.budgetPerPerson)}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="days">
                Days
              </label>
              <input
                id="days"
                type="number"
                min={1}
                max={10}
                className="input !py-2.5"
                value={days}
                onChange={(event) => setDays(Math.min(Math.max(Number(event.target.value) || 1, 1), 10))}
              />
            </div>
            <div>
              <label className="label" htmlFor="travellers">
                Travellers
              </label>
              <input
                id="travellers"
                type="number"
                min={1}
                max={12}
                className="input !py-2.5"
                value={travellers}
                onChange={(event) => setTravellers(Math.min(Math.max(Number(event.target.value) || 1, 1), 12))}
              />
            </div>
          </div>

          <label className="label mt-4" htmlFor="budget">
            Budget per person · {formatINR(budget)}
          </label>
          <input
            id="budget"
            type="range"
            min={3000}
            max={60000}
            step={1000}
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-saffron-400"
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {BUDGET_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setBudget(preset.value)}
                className={`chip ${budget === preset.value ? "!border-saffron-400/60 !bg-saffron-400/15 !text-saffron-200" : ""}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="label mt-5">Pace</label>
          <div className="grid grid-cols-3 gap-2">
            {PACES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPace(option.value)}
                className={`rounded-xl border px-2 py-2.5 text-center transition ${
                  pace === option.value
                    ? "border-saffron-400/60 bg-saffron-400/12 text-saffron-200"
                    : "border-white/10 bg-white/3 text-sand-200/70 hover:border-white/25"
                }`}
              >
                <span className="block text-xs font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[0.62rem] text-sand-200/50">{option.hint}</span>
              </button>
            ))}
          </div>

          <label className="label mt-5" htmlFor="start-date">
            Start date (optional)
          </label>
          <input
            id="start-date"
            type="date"
            className="input !py-2.5"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />

          <button
            type="button"
            className="btn btn-primary mt-6 w-full !py-3"
            onClick={() => void generate()}
            disabled={generating}
          >
            {generating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
                Retrieving context…
              </>
            ) : (
              <>
                <SparkleIcon width={17} height={17} /> Generate itinerary
              </>
            )}
          </button>

          <div className="mt-4 border-t border-white/8 pt-4">
            <p className="text-[0.68rem] uppercase tracking-[0.14em] text-sand-200/45">Try one of these</p>
            <div className="mt-2 grid gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="rounded-xl bg-white/4 px-3 py-2 text-left text-[0.72rem] leading-relaxed text-sand-200/75 transition hover:bg-white/8 hover:text-sand-100"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* result */}
        <section>
          {error ? (
            <div className="glass mb-4 flex items-start gap-3 rounded-2xl border border-coral-400/40 bg-coral-400/8 p-4 text-sm text-coral-300">
              <AlertIcon width={17} height={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {!plan ? (
            <div className="glass grid place-items-center rounded-3xl border-dashed px-6 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-saffron-400/12 text-saffron-300 ring-1 ring-inset ring-saffron-400/25">
                <CompassIcon width={28} height={28} />
              </span>
              <h2 className="mt-5 font-display text-2xl font-semibold">Your day-wise plan appears here</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-sand-200/65">
                Describe the trip on the left - in Hindi or English, typed or spoken. Safarnama retrieves the matching
                destination CONTEXT, splits places across your days, picks a stay inside your budget and costs the whole
                thing.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href="/search" className="btn btn-ghost !py-2">
                  Browse destinations
                </Link>
                <button type="button" className="btn btn-primary !py-2" onClick={() => setPrompt(EXAMPLES[0])}>
                  Use an example
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {/* summary */}
              <article className="glass overflow-hidden rounded-3xl">
                <div className="relative h-40">
                  {selected?.image ? (
                    <img src={selected.image} alt={plan.destinationName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-ink-700 to-ink-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
                  <div className="absolute inset-x-5 bottom-4">
                    <h2 className="font-display text-2xl font-semibold leading-tight">{plan.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-[0.72rem] text-sand-200/75">
                      <span className="flex items-center gap-1">
                        <CalendarIcon width={13} height={13} /> {plan.days} days
                      </span>
                      <span className="flex items-center gap-1">
                        <RouteIcon width={13} height={13} /> {plan.travellers} travellers
                      </span>
                      <span className="flex items-center gap-1">
                        <ClockIcon width={13} height={13} /> {plan.pace} pace
                      </span>
                      <span className="flex items-center gap-1">
                        <RupeeIcon width={13} height={13} /> {formatINR(plan.totalPerPerson)} per person
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-[1.4fr_1fr]">
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-saffron-300/85">Overview</p>
                    <p className="mt-2 text-sm leading-relaxed text-sand-200/80">{plan.overview}</p>

                    {parsed && parsed.interests.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {parsed.interests.map((interest) => (
                          <span key={interest} className="chip !px-2 !py-0.5 !text-[0.65rem]">
                            #{interest}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl bg-white/4 p-4">
                    <p className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-jade-300/85">
                      <BedIcon width={13} height={13} /> Recommended stay
                    </p>
                    <p className="mt-2 font-display text-base font-semibold leading-tight">{plan.hotel.name}</p>
                    <p className="mt-0.5 text-xs text-sand-200/60">{plan.hotel.area}</p>
                    {plan.hotel.note ? <p className="mt-2 text-xs leading-relaxed text-sand-200/70">{plan.hotel.note}</p> : null}
                    <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-xs">
                      <span className="flex items-center gap-1 text-saffron-200">
                        <StarIcon width={12} height={12} /> {plan.hotel.rating.toFixed(1)} · {plan.hotel.tier}
                      </span>
                      <span className="font-semibold text-sand-100">{formatINR(plan.hotel.pricePerNight)}/night</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* days */}
              {plan.plan.map((day) => (
                <article key={day.day} className="glass rounded-3xl p-5 animate-fade-up">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-saffron-300/85">
                        Day {day.day} · {day.focus || "exploration"}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-semibold leading-tight">{day.title}</h3>
                    </div>
                    <span className="rounded-full bg-white/6 px-3 py-1 text-[0.68rem] text-sand-200/70">
                      ~{formatINR(day.estimatedCostPerPerson)} / person
                    </span>
                  </div>

                  <ol className="mt-4 grid gap-2.5">
                    {day.schedule.map((item, index) => (
                      <li key={`${day.day}-${index}`} className="flex gap-3.5 rounded-2xl bg-white/3 p-3.5">
                        <span className="grid h-9 w-14 shrink-0 place-items-center rounded-xl bg-ink-950/50 font-display text-xs font-semibold text-saffron-300">
                          {item.time}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-sand-100">{item.activity}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-sand-200/70">{item.detail}</span>
                          <span className="mt-1.5 inline-flex items-center gap-1 text-[0.68rem] text-jade-300/85">
                            <RupeeIcon width={11} height={11} /> {item.cost}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  <p className="mt-3.5 text-[0.72rem] text-sand-200/55">
                    <span className="font-semibold text-sand-200/75">Food:</span> {day.meals.join(" · ")}
                  </p>
                </article>
              ))}

              {/* budget + tips + sources */}
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="glass rounded-3xl p-5">
                  <h3 className="font-display text-lg font-semibold">Estimated budget</h3>
                  <ul className="mt-3.5 grid gap-2">
                    {plan.budgetBreakdown.map((line) => (
                      <li key={line.label} className="flex items-baseline justify-between gap-3 rounded-xl bg-white/3 px-3.5 py-2.5">
                        <span>
                          <span className="block text-xs font-medium text-sand-100">{line.label}</span>
                          <span className="block text-[0.68rem] text-sand-200/50">{line.note}</span>
                        </span>
                        <span className="shrink-0 font-display text-sm font-semibold text-saffron-300">
                          {formatINR(line.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-saffron-400/30 bg-saffron-400/10 px-3.5 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-saffron-200">Total</span>
                    <span className="text-right">
                      <span className="block font-display text-base font-semibold text-sand-100">
                        {formatINR(plan.totalPerPerson)} / person
                      </span>
                      <span className="block text-[0.68rem] text-sand-200/60">
                        {formatINR(plan.totalForGroup)} for {plan.travellers} travellers
                      </span>
                    </span>
                  </div>
                </article>

                <article className="glass rounded-3xl p-5">
                  <h3 className="font-display text-lg font-semibold">Local tips</h3>
                  <ul className="mt-3.5 grid gap-2.5">
                    {plan.tips.map((tip) => (
                      <li key={tip.text} className="rounded-2xl bg-white/3 p-3.5">
                        <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-coral-300">
                          {tip.category}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-sand-200/80">{tip.text}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>

              <article className="glass rounded-3xl p-5">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                  <InfoIcon width={16} height={16} className="text-jade-300" /> Retrieval sources
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-sand-200/60">
                  Every line above comes from these rows in your PostgreSQL database - the generator never invents
                  facts or calls an external model.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plan.sources.map((source) => (
                    <span key={source} className="chip !px-2 !py-0.5 !text-[0.66rem]">
                      {source}
                    </span>
                  ))}
                </div>
              </article>

              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="btn btn-primary" onClick={() => void exportPdf()} disabled={exporting}>
                  <DownloadIcon width={16} height={16} /> {exporting ? "Building PDF…" : "Download PDF itinerary"}
                </button>
                <button
                  type="button"
                  className="btn btn-jade"
                  onClick={() => void saveTrip()}
                  disabled={saving || Boolean(savedTripId)}
                >
                  {savedTripId ? <CheckIcon width={16} height={16} /> : <RouteIcon width={16} height={16} />}
                  {savedTripId ? "Saved to My Trips" : saving ? "Saving…" : "Save to My Trips"}
                </button>
                {savedTripId ? (
                  <Link href="/trips" className="btn btn-ghost">
                    Open My Trips
                  </Link>
                ) : null}
                <Link href={`/destinations/${plan.destinationSlug}`} className="btn btn-ghost">
                  View {plan.destinationName} guide
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default function PlannerPage() {
  return (
    <Suspense
      fallback={<div className="grid min-h-screen place-items-center bg-ink-950 text-sand-200/60">Loading planner…</div>}
    >
      <PlannerInner />
    </Suspense>
  );
}