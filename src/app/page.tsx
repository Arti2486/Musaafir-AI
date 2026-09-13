import Link from "next/link";
import { ArrowRightIcon, CompassIcon, MicIcon, RouteIcon, ShieldIcon, SparkleIcon, StarIcon } from "@/components/icons";
import { loadBundles } from "@/lib/data";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: SparkleIcon,
    title: "RAG itinerary generator",
    text: "Retrieval over the destinations.context column, hotels, places and tips. No hallucinated advice - every line is traceable to a source row.",
  },
  {
    icon: MicIcon,
    title: "Hindi + English voice",
    text: "Web Speech API with auto language detection. Say \"teen din ka Goa trip do logon ke liye\" and the planner extracts the details.",
  },
  {
    icon: RouteIcon,
    title: "Trip history & PDF",
    text: "Save plans to PostgreSQL, reopen them any time, and export a formatted A4 itinerary with jsPDF.",
  },
  {
    icon: ShieldIcon,
    title: "Auth that actually works",
    text: "bcrypt hashing with 10 salt rounds, lowercase email normalisation, 7-day JWT sessions and a seeded demo login.",
  },
];

export default async function LandingPage() {
  let destinations: Awaited<ReturnType<typeof loadBundles>> = [];
  let dbReady = true;
  try {
    destinations = await loadBundles();
  } catch (error) {
    dbReady = false;
    console.error("[LANDING] PostgreSQL not connected - check DATABASE_URL:", error instanceof Error ? error.message : error);
  }

  const featured = [...destinations].sort((a, b) => b.destination.rating - a.destination.rating).slice(0, 8);
  const hotelCount = destinations.reduce((sum, bundle) => sum + bundle.hotels.length, 0);
  const placeCount = destinations.reduce((sum, bundle) => sum + bundle.places.length, 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* hero */}
      <section className="relative">
        <div className="absolute inset-0 -z-10">
          <img
            src="https://images.pexels.com/photos/29494221/pexels-photo-29494221.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
            alt="High altitude road through the Ladakh Himalaya"
            className="animate-ken-burns h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,17,0.82),rgba(5,11,17,0.72)_45%,rgba(5,11,17,0.98))]" />
        </div>

        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <span className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-saffron-400 to-coral-400 text-ink-950">
              <CompassIcon width={20} height={20} />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Musaafir <span className="text-saffron-400">AI</span>
            </span>
          </span>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost !py-2">
              Login
            </Link>
            <Link href="/signup" className="btn btn-primary !py-2">
              Get started
            </Link>
          </nav>
        </header>

        <div className="mx-auto max-w-7xl px-6 pb-24 pt-14 sm:pt-20">
          <span className="animate-fade-up chip !border-saffron-400/35 !bg-saffron-400/10 !text-saffron-200">
            <span className="h-1.5 w-1.5 rounded-full bg-jade-300" />
            {dbReady
              ? `Live knowledge base · ${destinations.length} destinations · ${placeCount} places · ${hotelCount} stays`
              : "PostgreSQL not connected - check DATABASE_URL"}
          </span>

          <h1 className="animate-fade-up delay-100 mt-6 max-w-4xl font-display text-[clamp(2.5rem,6.6vw,4.75rem)] font-semibold leading-[1.02] tracking-tight">
            Your next Indian trip,
            <span className="text-gradient-saffron"> planned in one sentence.</span>
          </h1>

          <p className="animate-fade-up delay-200 mt-6 max-w-2xl text-base leading-relaxed text-sand-200/75 sm:text-lg">
            Musaafir AI reads a curated CONTEXT library of {destinations.length || 20} destinations - real hotels, entry
            fees, permits, best timings and local warnings - and turns it into a day-wise itinerary you can download as a
            PDF and keep in your trip history.
          </p>

          <div className="animate-fade-up delay-300 mt-9 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn btn-primary !px-6 !py-3.5 text-base">
              Start planning free
              <ArrowRightIcon width={18} height={18} />
            </Link>
            <Link href="/login" className="btn btn-ghost !px-6 !py-3.5 text-base">
              Try the demo login
            </Link>
            <span className="text-xs leading-relaxed text-sand-200/50">
              test@gmail.com / 123456
              <br />
              seeded automatically on first boot
            </span>
          </div>

          <dl className="animate-fade-up delay-400 mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Destinations", value: destinations.length || 20 },
              { label: "Curated places", value: placeCount || "120+" },
              { label: "Stay options", value: hotelCount || "70+" },
              { label: "Local tips", value: "80+" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl px-4 py-3.5">
                <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-sand-200/55">{stat.label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-saffron-300">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* featured destinations */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-saffron-300/80">The knowledge base</p>
            <h2 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold">
              Twenty destinations, deeply documented
            </h2>
          </div>
          <Link href="/signup" className="btn btn-ghost">
            Browse all after signup <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((bundle, index) => (
            <article
              key={bundle.destination.slug}
              className={`animate-fade-up card-lift glass group relative overflow-hidden rounded-2xl ${
                index % 4 === 0 ? "delay-100" : ""
              }`}
            >
              <div className="relative h-36 overflow-hidden">
                {bundle.destination.image ? (
                  <img
                    src={bundle.destination.image}
                    alt={bundle.destination.name}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/35 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-saffron-200 backdrop-blur">
                  {bundle.destination.category}
                </span>
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-ink-950/70 px-2.5 py-1 text-[0.7rem] font-semibold text-sand-100 backdrop-blur">
                  <StarIcon width={12} height={12} className="text-saffron-400" />
                  {bundle.destination.rating.toFixed(1)}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-semibold leading-tight">{bundle.destination.name}</h3>
                <p className="mt-0.5 text-xs text-sand-200/55">
                  {bundle.destination.state} · {bundle.destination.region}
                </p>
                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-sand-200/70">
                  {bundle.destination.description}
                </p>
                <p className="mt-3 text-[0.7rem] uppercase tracking-wide text-jade-300/80">
                  from ₹{bundle.destination.budgetPerPerson.toLocaleString("en-IN")} / person
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="border-y border-white/8 bg-ink-900/60 px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card-lift glass rounded-2xl p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-saffron-400/12 text-saffron-300 ring-1 ring-inset ring-saffron-400/25">
                <feature.icon width={20} height={20} />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold leading-snug">{feature.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-sand-200/65">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="font-display text-[clamp(1.9rem,4.4vw,3rem)] font-semibold leading-tight">
          Ready when you are, <span className="text-gradient-saffron">musafir</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-sand-200/70">
          Create an account, speak your trip in Hindi or English, and walk away with a costed, day-wise plan you can
          download and share.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn btn-primary !px-6 !py-3.5 text-base">
            Create free account <ArrowRightIcon width={18} height={18} />
          </Link>
          <Link href="/login" className="btn btn-ghost !px-6 !py-3.5 text-base">
            Login
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/8 px-6 py-8 text-center text-xs text-sand-200/40">
        Musaafir AI · Next.js App Router · Drizzle ORM + PostgreSQL · bcrypt + JWT · jsPDF · Web Speech API
      </footer>
    </div>
  );
}
