"use client";

import Link from "next/link";
import { BedIcon, MapPinIcon, StarIcon } from "@/components/icons";

export type DestinationSummary = {
  id?: number;
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
  hotelCount?: number;
  placeCount?: number;
  tipCount?: number;
  priceFrom?: number;
};

export function DestinationCard({ destination, index = 0 }: { destination: DestinationSummary; index?: number }) {
  return (
    <Link
      href={`/destinations/${destination.slug}`}
      className="card-lift glass group relative block overflow-hidden rounded-2xl animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="relative h-44 overflow-hidden">
        {destination.image ? (
          <img
            src={destination.image}
            alt={destination.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-[900ms] group-hover:scale-[1.12]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-ink-700 to-ink-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />

        <span className="absolute left-3.5 top-3.5 rounded-full bg-ink-950/72 px-2.5 py-1 text-[0.63rem] font-semibold uppercase tracking-[0.12em] text-saffron-200 backdrop-blur">
          {destination.category}
        </span>
        <span className="absolute right-3.5 top-3.5 flex items-center gap-1 rounded-full bg-ink-950/72 px-2.5 py-1 text-[0.72rem] font-semibold text-sand-100 backdrop-blur">
          <StarIcon width={12} height={12} className="text-saffron-400" />
          {Number(destination.rating).toFixed(1)}
        </span>

        <div className="absolute inset-x-3.5 bottom-3">
          <h3 className="font-display text-[1.35rem] font-semibold leading-tight text-sand-100">{destination.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.72rem] text-sand-200/70">
            <MapPinIcon width={12} height={12} className="text-jade-300" />
            {destination.state} · {destination.region}
          </p>
        </div>
      </div>

      <div className="p-4">
        <p className="line-clamp-2 text-xs leading-relaxed text-sand-200/65">{destination.description}</p>

        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {typeof destination.placeCount === "number" ? (
            <span className="chip !px-2 !py-0.5 !text-[0.68rem]">{destination.placeCount} places</span>
          ) : null}
          {typeof destination.hotelCount === "number" ? (
            <span className="chip !px-2 !py-0.5 !text-[0.68rem]">
              <BedIcon width={11} height={11} /> {destination.hotelCount} stays
            </span>
          ) : null}
          <span className="chip !px-2 !py-0.5 !text-[0.68rem]">{destination.bestTime}</span>
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-white/8 pt-3">
          <span className="text-[0.7rem] uppercase tracking-wide text-sand-200/50">Typical budget</span>
          <span className="font-display text-base font-semibold text-saffron-300">
            ₹{Math.round(destination.budgetPerPerson).toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function DestinationCardSkeleton() {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="skeleton h-44 w-full" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-3 w-4/5 rounded-full" />
        <div className="skeleton h-3 w-3/5 rounded-full" />
        <div className="skeleton h-3 w-2/5 rounded-full" />
      </div>
    </div>
  );
}
