"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ChatIcon,
  CompassIcon,
  GridIcon,
  LogoutIcon,
  RouteIcon,
  SearchIcon,
  SparkleIcon,
  UserIcon,
} from "@/components/icons";
import { fetchMe, logoutRequest, getToken, getStoredUser, type SessionUser } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: GridIcon },
  { href: "/search", label: "Search", icon: SearchIcon },
  { href: "/planner", label: "AI Planner", icon: SparkleIcon },
  { href: "/assistant", label: "Assistant", icon: ChatIcon },
  { href: "/trips", label: "My Trips", icon: RouteIcon },
];

/**
 * Client-side auth gate + navigation chrome.
 * Redirects to /login when no `musaafir_token` is present or the JWT is rejected.
 */
export function AppShell({ children, title, subtitle, actions }: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!getToken()) {
        if (!active) return;
        setChecking(false);
        router.replace("/login?reason=missing-token");
        return;
      }
      const me = await fetchMe();
      if (!active) return;
      if (!me) {
        router.replace("/login?reason=expired");
        setChecking(false);
        return;
      }
      setUser(me);
      setChecking(false);
    }

    void verify();
    return () => {
      active = false;
    };
  }, [router]);

  const closeMobileNav = useCallback(() => setMobileOpen(false), []);

  const handleLogout = useCallback(async () => {
    await logoutRequest();
    router.replace("/login?reason=logout");
  }, [router]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <div className="flex flex-col items-center gap-4">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-saffron-400/30 border-t-saffron-400" />
          <p className="text-sm tracking-wide text-sand-200/60">Checking your session…</p>
        </div>
      </div>
    );
  }

  const initials = (user?.name ?? getStoredUser()?.name ?? "Y")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-ink-950">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[26rem] bg-[radial-gradient(60%_100%_at_20%_0%,rgba(248,171,67,0.16),transparent_70%),radial-gradient(50%_100%_at_85%_0%,rgba(63,201,174,0.14),transparent_70%)]"
      />

      <header className="sticky top-0 z-40 border-b border-white/8 glass-strong">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-saffron-400 to-coral-400 text-ink-950 transition group-hover:scale-105">
              <CompassIcon width={19} height={19} />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block font-display text-[1.05rem] font-semibold tracking-tight text-sand-100">
                Musaafir <span className="text-saffron-400">AI</span>
              </span>
              <span className="block text-[0.65rem] uppercase tracking-[0.22em] text-sand-200/50">India trip planner</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-saffron-400/15 text-saffron-200 ring-1 ring-inset ring-saffron-400/35"
                      : "text-sand-200/70 hover:bg-white/6 hover:text-sand-100"
                  }`}
                >
                  <item.icon width={16} height={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/4 py-1 pl-1 pr-3 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-jade-400 to-jade-500 text-[0.7rem] font-bold text-ink-950">
                {initials}
              </span>
              <span className="max-w-[9rem] truncate text-xs font-medium text-sand-100">{user?.email}</span>
            </div>
            <button type="button" onClick={handleLogout} className="btn btn-ghost !px-3 !py-2" title="Logout">
              <LogoutIcon width={16} height={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="btn btn-ghost !px-3 !py-2 lg:hidden"
              aria-label="Toggle navigation"
            >
              <UserIcon width={16} height={16} />
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav className="grid gap-1 border-t border-white/8 px-4 py-3 lg:hidden">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileNav}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active ? "bg-saffron-400/15 text-saffron-200" : "text-sand-200/75 hover:bg-white/6"
                  }`}
                >
                  <item.icon width={17} height={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.5rem)] font-semibold leading-tight text-sand-100">
              {title}
            </h1>
            {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-sand-200/65">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>

      <footer className="relative border-t border-white/8 px-6 py-6 text-center text-xs text-sand-200/45">
        Musaafir AI · grounded answers come only from the destination CONTEXT knowledge base · demo login
        test@gmail.com / 123456
      </footer>
    </div>
  );
}
