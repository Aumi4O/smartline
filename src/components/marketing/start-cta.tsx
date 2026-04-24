"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Label on the primary submit button. */
  label?: string;
  /** Visual size; matches the shadcn Button sizes. */
  size?: "default" | "sm" | "lg";
  /** Full-width on mobile. */
  fullWidth?: boolean;
  /** Caption under the form (small gray text). Pass null to hide. */
  caption?: React.ReactNode;
  /** Optional layout — 'row' (email + button inline on desktop) or 'stack' (stacked). */
  layout?: "row" | "stack";
}

/**
 * Zero-friction "Start for $5" email capture.
 *
 * Posts to /api/billing/start-guest → redirects straight to Stripe Checkout.
 * No login detour. No password. If the email is already tied to an account
 * with an active plan, we route them to /login → /dashboard instead.
 */
export function StartCTA({
  label = "Start for $5",
  size = "lg",
  fullWidth = true,
  caption = "$5 today · 3 days full access · $199/mo auto-starts on day 4",
  layout = "row",
}: Props) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/billing/start-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErr(data.error || "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-12 rounded-lg border border-gray-200 bg-white px-4 text-base text-black placeholder:text-gray-400 focus:border-black focus:outline-none";

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={
          layout === "row"
            ? "flex flex-col gap-2 sm:flex-row"
            : "flex flex-col gap-2"
        }
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={`${inputClass} ${
            layout === "row" ? "flex-1 sm:min-w-[240px]" : "w-full"
          }`}
          autoComplete="email"
        />
        <Button
          type="submit"
          size={size}
          disabled={loading}
          className={fullWidth ? "w-full sm:w-auto" : ""}
        >
          {loading ? "Redirecting…" : label}
        </Button>
      </div>
      {err && (
        <p className="mt-2 text-left text-xs text-red-600">{err}</p>
      )}
      {caption && (
        <p className="mt-2 text-left text-xs text-gray-500 sm:text-center">
          {caption}
        </p>
      )}
    </form>
  );
}
