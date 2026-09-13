import Link from "next/link";
import type { ReactNode } from "react";
import { CompassIcon, MicIcon, RouteIcon, ShieldIcon, SparkleIcon } from "@/components/icons";

const HIGHLIGHTS = [
  { icon: SparkleIcon, title: "Grounded AI itineraries", text: "Day-wise plans built only from the destination CONTEXT - hotels, entry fees, permits and timings." },
  { icon: MicIcon, title: "Hindi + English voice", text: "Speak \"teen din ka Udaipur trip\" and the planner parses days, travellers and budget." },
  { icon: RouteIcon, title: "Trips you can keep", text: "Save every plan to Postgres, reopen it from history and export a print-ready PDF." },
  { icon: ShieldIcon, title: "Real auth, real DB", text: "bcrypt (10 rounds) password hashing, JWT sessions valid for 7 days, Drizzle + PostgreSQL." },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="absolute inset-0 -z-10">
        <img
          src="https://images.pexels.com/photos/29494221/pexels-photo-29494221.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
          alt="Mountain highway through the Ladakh Himalaya"
          className="animate-ken-burns h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(5,11,17,0.94)_18%,rgba(5,11,17,0.72)_55%,rgba(5,11,17,0.95))]" />
      </div>

      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400 to-coral-400 text-ink-950">
            <CompassIcon width={22} height={22} />
          </span>
          <span>
            <span className="block font-display text-xl font-semibold tracking-tight">
              Musaafir <span className="text-saffron-400">AI</span>
            </span>
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-sand-200/55">India trip planner</span>
          </span>
        </Link>

        <div className="max-w-lg">
          <h2 className="font-display text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.08]">
            Plan the trip.
            <br />
            <span className="text-gradient-saffron">Skip the research rabbit hole.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-sand-200/70">
            Twenty-plus Indian destinations, hand-curated costs, permits and local tips - turned into a day-wise
            itinerary in one prompt or one sentence spoken aloud.
          </p>

          <ul className="mt-9 grid gap-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/6 text-saffron-300">
                  <item.icon width={17} height={17} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-sand-100">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-sand-200/60">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sand-200/45">
          Demo account · <span className="text-sand-100/80">test@gmail.com</span> /{" "}
          <span className="text-sand-100/80">123456</span>
        </p>
      </section>

      <section className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[26rem]">
          <div className="animate-fade-up glass rounded-[1.6rem] p-7 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] sm:p-9">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-saffron-400 to-coral-400 text-ink-950">
                <CompassIcon width={20} height={20} />
              </span>
              <span className="font-display text-lg font-semibold">
                Musaafir <span className="text-saffron-400">AI</span>
              </span>
            </div>

            <h1 className="font-display text-[1.7rem] font-semibold leading-tight text-sand-100">{title}</h1>
            <p className="mt-1.5 text-sm text-sand-200/65">{subtitle}</p>

            <div className="mt-7">{children}</div>
          </div>

          <div className="mt-5 text-center text-sm text-sand-200/70">{footer}</div>
        </div>
      </section>
    </div>
  );
}
