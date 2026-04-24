"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeCallbackPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/dashboard";
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("resend", { email, callbackUrl });
    setSent(true);
  };

  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-black">SmartLine</h1>
        <p className="mt-2 text-sm text-gray-500">
          Sign in to manage your voice agents
        </p>
      </div>

      <div className="space-y-4">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl })}
        >
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {sent ? (
          <p className="py-4 text-center text-sm text-gray-500">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Continue with Email
            </Button>
          </form>
        )}
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

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-[360px] text-center text-sm text-gray-500">Loading…</div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
