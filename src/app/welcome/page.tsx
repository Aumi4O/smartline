"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const ACCENT = "#0066FF";

function WelcomeContent() {
  const params = useSearchParams();
  const emailFromUrl = params.get("email") || "";
  const activated = params.get("activated") === "1";

  const [email, setEmail] = useState(emailFromUrl);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // If we landed here from a successful Stripe checkout, send the magic
  // link immediately so the user doesn't have to think.
  useEffect(() => {
    if (activated && emailFromUrl && !sent) {
      void send(emailFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(to: string) {
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
    setSending(true);
    try {
      await signIn("resend", { email: to, callbackUrl: "/dashboard" });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-[480px] text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(0, 102, 255, 0.1)" }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-black">
        {activated ? "Payment received" : "Welcome to SmartLine"}
      </h1>
      <p className="mt-3 text-gray-600">
        {activated
          ? "Your $5 activation is charged. Your agent is unlocked."
          : "Sign in to pick up where you left off."}
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left">
          <p className="text-sm font-medium text-black">Check your email</p>
          <p className="mt-2 text-sm text-gray-600">
            We just sent a sign-in link to{" "}
            <span className="font-medium text-black">{email}</span>.
            Click it to open your dashboard and set up your first agent.
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Didn&apos;t get it? Check spam, or{" "}
            <button
              type="button"
              onClick={() => void send(email)}
              className="text-black underline"
            >
              resend
            </button>
            .
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(email);
          }}
          className="mt-8 flex flex-col items-stretch gap-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-base text-black placeholder:text-gray-400 focus:border-black focus:outline-none"
          />
          <Button
            type="submit"
            size="lg"
            disabled={sending || !email}
            className="w-full"
          >
            {sending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-xs text-gray-400">
        We&apos;ll email a one-click sign-in link. No password. No hassle.
      </p>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-[480px] text-center text-sm text-gray-500">
            Loading…
          </div>
        }
      >
        <WelcomeContent />
      </Suspense>
    </div>
  );
}
