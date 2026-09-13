"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { AlertIcon, ArrowRightIcon, InfoIcon, SparkleIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { ApiError, getToken, loginRequest } from "@/lib/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "info"; text: string } | null>(null);

  useEffect(() => {
    const message = searchParams.get("message");
    const reason = searchParams.get("reason");
    if (message === "signup-success") {
      setBanner({ kind: "success", text: "Signup successful, please login" });
      toast.success("Signup successful", "Please login with your new account.");
    } else if (reason === "expired") {
      setBanner({ kind: "info", text: "Your session expired. Please login again." });
    } else if (reason === "missing-token") {
      setBanner({ kind: "info", text: "Login required to open the dashboard." });
    } else if (reason === "logout") {
      setBanner({ kind: "success", text: "You have been logged out." });
    }
  }, [searchParams, toast]);

  // Already signed in? Straight to the dashboard.
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setBanner(null);

    if (!email.trim() || !password) {
      setFormError("Enter both your email and password.");
      toast.error("Missing details", "Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await loginRequest(email, password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}!`, "Redirecting to your dashboard…");
      router.replace("/dashboard");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Login failed. Is the Next.js server and PostgreSQL running?";
      setFormError(message);
      toast.error("Invalid email or password", message);
      console.error("[LOGIN PAGE]", error);
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo() {
    setEmail("test@gmail.com");
    setPassword("123456");
    setFormError(null);
    toast.info("Demo credentials filled", "Press Login to continue.");
  }

  return (
    <AuthLayout
      title="Login to Musaafir"
      subtitle="Pick up your saved trips and generate a new itinerary."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-saffron-300 underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {banner ? (
        <div
          className={`mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${
            banner.kind === "success"
              ? "border-jade-400/40 bg-jade-400/10 text-jade-300"
              : "border-saffron-400/40 bg-saffron-400/10 text-saffron-200"
          }`}
        >
          {banner.kind === "success" ? (
            <InfoIcon width={15} height={15} className="mt-px shrink-0" />
          ) : (
            <InfoIcon width={15} height={15} className="mt-px shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="input pr-20"
              placeholder="••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sand-200/60 transition hover:bg-white/8 hover:text-sand-100"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {formError ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-coral-400/45 bg-coral-400/10 px-3.5 py-3 text-xs leading-relaxed text-coral-300">
            <AlertIcon width={15} height={15} className="mt-px shrink-0" />
            <span>{formError}</span>
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary mt-1 w-full" disabled={submitting}>
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
              Verifying…
            </>
          ) : (
            <>
              Login
              <ArrowRightIcon width={17} height={17} />
            </>
          )}
        </button>

        <button type="button" onClick={fillDemo} className="btn btn-ghost w-full">
          <SparkleIcon width={16} height={16} className="text-saffron-300" />
          Use demo account (test@gmail.com / 123456)
        </button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-ink-950 text-sand-200/60">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
