"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  MapPinIcon,
  RouteIcon,
  RupeeIcon,
  SparkleIcon,
  TrashIcon,
} from "@/components/icons";
import { useToast } from "@/components/toast";
import { apiFetch, formatDate, formatINR, getStoredUser } from "@/lib/client";
import { downloadItineraryPdf } from "@/lib/pdf";
import type { ItineraryPlan } from "@/lib/rag";

type Trip = {
  id: number;
  title: string;
  destinationName: string;
  destinationSlug: string | null;
  days: number;
  travellers: number;
  budgetPerPerson: number;
  startDate: string | null;
  pace: string;
  prompt: string | null;
  createdAt: string;
  itinerary: ItineraryPlan;
};

export default function TripsPage() {
  const toast = useToast();
  const user = getStoredUser();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ trips: Trip[] }>("/api/trips");
      setTrips(data.trips ?? []);
    } catch (error) {
      console.error("[TRIPS]", error);
      toast.error("Could not load your trips", error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep link from the dashboard: /trips?open=12
  useEffect(() => {
    if (loading || trips.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const open = Number(params.get("open"));
    if (open && trips.some((trip) => trip.id === open)) setOpenId(open);
  }, [loading, trips]);

  async function removeTrip(trip: Trip) {
    setBusyId(trip.id);
    try {
      await apiFetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      setTrips((current) => current.filter((row) => row.id !== trip.id));
      if (openId === trip.id) setOpenId(null);
      toast.success("Trip deleted", `“${trip.title}” was removed from your history.`);
    } catch (error) {
      toast.error("Delete failed", error instanceof Error ? error.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function download(trip: Trip) {
    setBusyId(trip.id);
    try {
      const fileName = await downloadItineraryPdf(trip.itinerary, user?.name ?? null);
      toast.success("PDF downloaded", fileName);
    } catch (error) {
      console.error("[PDF]", error);
      toast.error("PDF export failed", error instanceof Error ? error.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  const totalSpend = trips.reduce((sum, trip) => sum + (trip.budgetPerPerson || 0), 0);

  return (
    <AppShell
      title="My trips"
      subtitle="Every itinerary you saved, straight from PostgreSQL. Reopen a plan, download its PDF or delete it."
      actions={
        <Link href="/planner" className="btn btn-primary !py-2">
          <SparkleIcon width={16} height={16} /> New itinerary
        </Link>
      }
    >
      {loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="glass h-28 rounded-3xl p-5">
              <div className="skeleton h-4 w-1/3 rounded-full" />
              <div className="skeleton mt-3 h-3 w-1/4 rounded-full" />
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="glass rounded-3xl border-dashed px-6 py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-saffron-400/12 text-saffron-300 ring-1 ring-inset ring-saffron-400/25">
            <RouteIcon width={28} height={28} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold">No trips saved yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sand-200/65">
            Head to the AI planner, generate an itinerary and press <span className="text-saffron-300">Save to My
            Trips</span>. The full day-wise plan, budget breakdown and tips are stored as JSON against your account.
          </p>
          <Link href="/planner" className="btn btn-primary mt-6">
            <SparkleIcon width={16} height={16} /> Generate my first trip
          </Link>
        </div>
      ) : (
        <>
          <section className="mb-5 grid gap-3.5 sm:grid-cols-3">
            {[
              { label: "Trips saved", value: trips.length, icon: RouteIcon },
              { label: "Total travel days", value: trips.reduce((sum, trip) => sum + trip.days, 0), icon: CalendarIcon },
              { label: "Planned spend", value: formatINR(totalSpend), icon: RupeeIcon },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[0.68rem] uppercase tracking-[0.14em] text-sand-200/55">{stat.label}</p>
                  <stat.icon width={16} height={16} className="text-saffron-300" />
                </div>
                <p className="mt-2 font-display text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-4">
            {trips.map((trip) => {
              const open = openId === trip.id;
              const plan = trip.itinerary;
              return (
                <article key={trip.id} className="glass overflow-hidden rounded-3xl animate-fade-up">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : trip.id)}
                    className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-white/4"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400/25 to-coral-400/20 font-display text-sm font-semibold text-saffron-200 ring-1 ring-inset ring-saffron-400/25">
                      {trip.days}d
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-semibold leading-tight">{trip.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-3 text-[0.72rem] text-sand-200/60">
                        <span className="flex items-center gap-1">
                          <MapPinIcon width={12} height={12} className="text-jade-300" /> {trip.destinationName}
                        </span>
                        <span className="flex items-center gap-1">
                          <RouteIcon width={12} height={12} /> {trip.travellers} travellers
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon width={12} height={12} /> {trip.pace}
                        </span>
                        <span className="flex items-center gap-1">
                          <RupeeIcon width={12} height={12} /> {formatINR(trip.budgetPerPerson)} pp
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon width={12} height={12} /> saved {formatDate(trip.createdAt)}
                          {trip.startDate ? ` · starts ${formatDate(trip.startDate)}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-saffron-300">{open ? "Hide" : "Open plan"}</span>
                  </button>

                  <div className="flex flex-wrap gap-2 border-t border-white/8 px-5 py-3">
                    <button type="button" className="btn btn-ghost !px-3.5 !py-2 !text-xs" onClick={() => void download(trip)} disabled={busyId === trip.id}>
                      <DownloadIcon width={14} height={14} /> PDF
                    </button>
                    {trip.destinationSlug ? (
                      <Link href={`/destinations/${trip.destinationSlug}`} className="btn btn-ghost !px-3.5 !py-2 !text-xs">
                        Destination guide
                      </Link>
                    ) : null}
                    <Link
                      href={`/planner?slug=${trip.destinationSlug ?? ""}&prompt=${encodeURIComponent(trip.prompt ?? "")}`}
                      className="btn btn-ghost !px-3.5 !py-2 !text-xs"
                    >
                      <SparkleIcon width={14} height={14} /> Re-plan
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost !px-3.5 !py-2 !text-xs !text-coral-300 hover:!border-coral-400/50"
                      onClick={() => void removeTrip(trip)}
                      disabled={busyId === trip.id}
                    >
                      <TrashIcon width={14} height={14} /> {busyId === trip.id ? "Working…" : "Delete"}
                    </button>
                  </div>

                  {open && plan ? (
                    <div className="space-y-4 border-t border-white/8 bg-ink-950/40 px-5 py-5">
                      <div className="rounded-2xl bg-white/4 p-4">
                        <p className="text-[0.66rem] uppercase tracking-[0.16em] text-saffron-300/85">Overview</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-sand-200/80">{plan.overview}</p>
                        {plan.prompt ? (
                          <p className="mt-2.5 text-xs italic text-sand-200/50">Original request: “{plan.prompt}”</p>
                        ) : null}
                      </div>

                      {plan.plan?.map((day) => (
                        <div key={day.day} className="rounded-2xl border border-white/8 bg-white/3 p-4">
                          <p className="font-display text-base font-semibold">{day.title}</p>
                          <p className="mt-0.5 text-[0.68rem] uppercase tracking-wide text-jade-300/80">
                            {day.focus} · stay {day.stay?.name}
                          </p>
                          <ul className="mt-3 grid gap-2">
                            {day.schedule?.map((item, index) => (
                              <li key={index} className="flex gap-3 text-xs">
                                <span className="w-14 shrink-0 font-display font-semibold text-saffron-300">{item.time}</span>
                                <span className="min-w-0">
                                  <span className="block font-semibold text-sand-100">{item.activity}</span>
                                  <span className="mt-0.5 block leading-relaxed text-sand-200/65">{item.detail}</span>
                                  <span className="mt-0.5 block text-[0.68rem] text-jade-300/80">{item.cost}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      {plan.budgetBreakdown?.length ? (
                        <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                          <p className="font-display text-base font-semibold">Budget</p>
                          <ul className="mt-2.5 grid gap-1.5">
                            {plan.budgetBreakdown.map((line) => (
                              <li key={line.label} className="flex items-baseline justify-between gap-3 text-xs">
                                <span className="text-sand-200/75">
                                  {line.label} <span className="text-sand-200/45">· {line.note}</span>
                                </span>
                                <span className="shrink-0 font-semibold text-saffron-300">{formatINR(line.amount)}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-3 border-t border-white/8 pt-2.5 text-sm font-semibold text-sand-100">
                            {formatINR(plan.totalPerPerson)} per person · {formatINR(plan.totalForGroup)} for{" "}
                            {plan.travellers} travellers
                          </p>
                        </div>
                      ) : null}

                      {plan.tips?.length ? (
                        <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                          <p className="font-display text-base font-semibold">Tips</p>
                          <ul className="mt-2.5 grid gap-2">
                            {plan.tips.map((tip) => (
                              <li key={tip.text} className="text-xs leading-relaxed text-sand-200/75">
                                <span className="font-semibold uppercase tracking-wide text-coral-300">{tip.category}: </span>
                                {tip.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
