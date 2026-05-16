"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export function FreeRegistrationForm() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/dashboard" }, { prompt: "select_account" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("sending");
    const result = await signIn("resend", {
      email: trimmed,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setStatus(result?.error ? "error" : "sent");
  }

  const message =
    status === "sent"
      ? "Check your email for the sign-in link."
      : status === "error"
        ? "Could not send the link. Try Google or try again."
        : "No card needed.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-black px-6 text-base font-medium text-white transition-colors hover:bg-gray-800 sm:w-auto"
      >
        Start free
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-registration-title"
        >
          <div className="w-full max-w-[420px] rounded-lg bg-white p-6 text-left shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="free-registration-title" className="text-xl font-semibold text-black">
                  Create your SmartLine account
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Explore the platform and build your first agent before payment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-black"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="text-base font-bold text-[#4285F4]">G</span>
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="sr-only" htmlFor="homepage-signup-email">
                Work email
              </label>
              <input
                id="homepage-signup-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Work email"
                autoComplete="email"
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-black"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="h-11 w-full rounded-lg bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {status === "sending" ? "Sending..." : "Continue with Email"}
              </button>
            </form>

            <p className="mt-3 text-center text-xs text-gray-500">{message}</p>
          </div>
        </div>
      )}
    </>
  );
}
