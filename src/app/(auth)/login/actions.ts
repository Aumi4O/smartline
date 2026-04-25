"use server";

import { signIn } from "@/lib/auth";

/**
 * Server actions for the login page.
 *
 * Why these exist instead of `signIn("google")` / `signIn("resend")` from
 * `next-auth/react`:
 *
 * The client `signIn()` does an internal `fetch("/api/auth/csrf")` and then
 * submits a form. The `await` between the user's tap and the form submission
 * loses the "user gesture" token that mobile browsers require to allow a
 * navigation. End result on iOS Safari, Mobile Chrome, and every in-app
 * WebView (Instagram / Messenger / Gmail / Slack / LinkedIn) — tap "Continue
 * with Google" and nothing happens. Desktop browsers don't enforce the
 * gesture token as strictly, which is why it appears to work there.
 *
 * A `<form action={serverAction}>` is a plain HTML submission — no JS, no
 * fetch in front of the navigation. NextAuth's server-side `signIn()`
 * internally calls `redirect()` (a thrown `NEXT_REDIRECT`) which the form
 * post translates into a clean 303 to Google's OAuth URL. Works on every
 * device, every browser, every WebView.
 *
 * Auth.js docs reference: https://authjs.dev/getting-started/authentication/oauth
 */

function safeCallbackPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeCallbackPath(formData.get("callbackUrl"));
  await signIn("google", { redirectTo: next });
}

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    // Fall through to default error page; we don't expose internals.
    throw new Error("Invalid email");
  }
  const next = safeCallbackPath(formData.get("callbackUrl"));
  await signIn("resend", { email, redirectTo: next });
}
