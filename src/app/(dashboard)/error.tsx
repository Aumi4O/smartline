"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-[480px] rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-black">Activate your account</h2>
        <p className="mt-2 text-sm text-gray-500">
          We hit a snag loading your dashboard. If you just signed up, your account
          may still be setting up — please try again in a moment or sign in again.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-black transition hover:bg-gray-50"
          >
            Back to sign in
          </Link>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Still stuck? Email{" "}
          <a href="mailto:support@leadagentsstudio.com" className="underline">
            support@leadagentsstudio.com
          </a>
          {error.digest ? ` (ref: ${error.digest})` : ""}
        </p>
      </div>
    </div>
  );
}
