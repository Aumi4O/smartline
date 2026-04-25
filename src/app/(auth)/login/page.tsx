import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithGoogle, signInWithEmail } from "./actions";

function safeCallbackPath(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/dashboard";
}

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const callbackUrl = safeCallbackPath(sp.next);

  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-black">SmartLine</h1>
        <p className="mt-2 text-sm text-gray-500">
          Sign in to manage your voice agents
        </p>
      </div>

      <div className="space-y-4">
        {/*
         * Google sign-in is a real <form action={serverAction}> instead of a
         * client-side button + fetch. That's the only pattern that works on
         * mobile browsers and in-app WebViews (Instagram, Messenger, Gmail,
         * Slack, LinkedIn). Don't switch this back to `signIn("google")` from
         * `next-auth/react` — it loses the user-gesture token on the awaited
         * fetch and the navigation is silently blocked.
         */}
        <form action={signInWithGoogle} className="contents">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
          >
            Continue with Google
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/*
         * After successful submission NextAuth redirects to
         * /login/verify (configured in src/lib/auth.ts as pages.verifyRequest).
         */}
        <form action={signInWithEmail} className="space-y-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Input
            type="email"
            name="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
            inputMode="email"
          />
          <Button type="submit" className="w-full">
            Continue with Email
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        By continuing, you agree to SmartLine&apos;s{" "}
        <a href="/terms" className="text-black underline hover:no-underline">Terms of Service</a>
        {" "}and{" "}
        <a href="/privacy" className="text-black underline hover:no-underline">Privacy Policy</a>.
      </p>
    </div>
  );
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-[360px] text-center text-sm text-gray-500">
            Loading…
          </div>
        }
      >
        <LoginContent {...props} />
      </Suspense>
    </div>
  );
}
