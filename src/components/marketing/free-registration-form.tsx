"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export function FreeRegistrationForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-8 flex max-w-[560px] flex-col gap-3 sm:flex-row sm:items-center"
    >
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
        className="h-12 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-4 text-base text-black outline-none transition-colors placeholder:text-gray-400 focus:border-black"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="h-12 rounded-lg bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {status === "sending" ? "Sending..." : "Register free"}
      </button>
      <p className="text-center text-xs text-gray-500 sm:text-left">{message}</p>
    </form>
  );
}
