"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { AlertIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { ApiError, signupRequest } from "@/lib/client";

function strengthOf(password: string) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 5);
}

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const strength = useMemo(() => strengthOf(password), [password]);
  const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"][strength];
  const strengthColor = ["bg-coral-400", "bg-coral-400", "bg-saffron-400", "bg-saffron-300", "bg-jade-400", "bg-jade-300"][
    strength
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (name.trim().length < 2) {
      setFormError("Please enter your name.");
      toast.error("Name required", "Tell us what to call you.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setFormError("Please enter a valid email address.");
      toast.error("Invalid email", "That email address does not look right.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      toast.error("Weak password", "Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      toast.error("Passwords do not match", "Re-type your password to confirm.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signupRequest(name.trim(), email.trim(), password);
      console.log("[SIGNUP PAGE] user created:", result.user);
      toast.success("Signup successful, please login", `Account created for ${result.user.email}`);
      router.push("/login?message=signup-success");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Signup failed. Is the Next.js server and PostgreSQL running?";
      setFormError(message);
      toast.error(message === "User already exists" ? "User already exists" : "Signup failed", message);
      console.error("[SIGNUP PAGE]", error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free forever. Your trips are stored in PostgreSQL against your account."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-saffron-300 underline-offset-4 hover:underline">
            Login instead
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className="input"
            placeholder="Aarav Sharma"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

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
              autoComplete="new-password"
              className="input pr-20"
              placeholder="At least 6 characters"
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
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${strengthColor}`}
                style={{ width: `${(strength / 5) * 100}%` }}
              />
            </div>
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-sand-200/55">{strengthLabel}</span>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="input"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {confirm && password === confirm ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-jade-300">
              <CheckIcon width={14} height={14} /> Passwords match
            </p>
          ) : null}
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
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRightIcon width={17} height={17} />
            </>
          )}
        </button>

        <p className="text-center text-[0.7rem] leading-relaxed text-sand-200/45">
          Passwords are hashed with bcrypt (10 salt rounds) and never stored in plain text. Sessions use a JWT signed
          with JWT_SECRET, valid for 7 days.
        </p>
      </form>
    </AuthLayout>
  );
}
