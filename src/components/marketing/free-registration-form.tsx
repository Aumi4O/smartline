"use client";

import { useEffect, useState } from "react";

type AuthAction = (formData: FormData) => void | Promise<void>;

interface FreeRegistrationFormProps {
  googleAction: AuthAction;
  emailAction: AuthAction;
}

export function FreeRegistrationForm({
  googleAction,
  emailAction,
}: FreeRegistrationFormProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#start-free") setOpen(true);
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <>
      <span id="start-free" className="inline-flex w-full scroll-mt-24 sm:w-auto">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-black px-10 text-[17px] font-semibold tracking-[-0.01em] text-white shadow-[0_6px_20px_rgba(10,10,10,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-900 hover:shadow-[0_10px_28px_rgba(10,10,10,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:w-auto sm:min-w-[230px]"
        >
          Start free
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </span>

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

            <form action={googleAction} className="mt-6">
              <input type="hidden" name="callbackUrl" value="/dashboard" />
              <input type="hidden" name="fresh" value="1" />
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                <span className="text-base font-bold text-[#4285F4]">G</span>
                Continue with Google
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <form action={emailAction} className="space-y-3">
              <input type="hidden" name="callbackUrl" value="/dashboard" />
              <input type="hidden" name="fresh" value="1" />
              <label className="sr-only" htmlFor="homepage-signup-email">
                Work email
              </label>
              <input
                id="homepage-signup-email"
                type="email"
                name="email"
                required
                placeholder="Work email"
                autoComplete="email"
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-black"
              />
              <button
                type="submit"
                className="h-11 w-full rounded-lg bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                Continue with Email
              </button>
            </form>

            <p className="mt-3 text-center text-xs text-gray-500">No card needed.</p>
          </div>
        </div>
      )}
    </>
  );
}
