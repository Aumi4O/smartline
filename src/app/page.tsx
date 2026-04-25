import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  START_LOGIN_HREF,
  getHearItTalkHref,
  hearItTalkClassName,
} from "@/lib/marketing";

const ACCENT = "#0066FF";

function Icon({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl"
      style={{ backgroundColor: "rgba(0, 102, 255, 0.08)", color: ACCENT }}
    >
      <div className="h-5 w-5">{children}</div>
    </div>
  );
}

function Check({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function X({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const STROKE: React.SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export default function HomePage() {
  const hearHref = getHearItTalkHref();
  const hearClass = hearItTalkClassName();

  return (
    <div className="flex min-h-screen flex-col bg-white text-black antialiased">
      {/* ============= HEADER ============= */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ACCENT }}
              aria-hidden
            />
            <span className="text-lg font-semibold tracking-tight">SmartLine</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <a href="#how" className="transition-colors hover:text-black">How it works</a>
            <a href="#pricing" className="transition-colors hover:text-black">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-black">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Sign In
            </Link>
            <a href={START_LOGIN_HREF} className={buttonClasses({ size: "sm" })}>
              Start for $5
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ============= HERO ============= */}
        <section className="relative overflow-hidden px-6 pt-14 pb-20 sm:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] max-w-[1000px]"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 0%, rgba(0,102,255,0.08) 0%, rgba(0,102,255,0) 70%)",
            }}
          />
          <div className="relative mx-auto max-w-[820px] text-center">
            <p
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium tracking-wide text-black"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: ACCENT }}
                aria-hidden
              />
              AI PHONE AGENTS · LIVE IN 5 MINUTES
            </p>

            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Never miss another profitable call.
            </h1>

            <p className="mx-auto mt-6 max-w-[640px] text-balance text-lg leading-relaxed text-gray-600">
              Your AI phone agent answers 24/7 in a natural voice, knows your business, books
              appointments, follows up leads, and runs outbound campaigns — for a fraction of the
              cost of a single receptionist.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={START_LOGIN_HREF}
                className={buttonClasses({
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                Start for $5 →
              </a>
              <a href={hearHref} className={hearClass}>
                Hear It Talk
              </a>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              $5 today unlocks full access for 3 days. Then $199/mo — cancel anytime.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
              <span>Powered by OpenAI</span>
              <span aria-hidden>·</span>
              <span>Twilio</span>
              <span aria-hidden>·</span>
              <span>Enterprise-grade security</span>
              <span aria-hidden>·</span>
              <span>GDPR + TCPA ready</span>
            </div>

            {/* Mini pricing strip — above the fold, shows the full billing flow */}
            <div className="mx-auto mt-12 grid max-w-[920px] gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
              {/* Step 1 — $5 today */}
              <a
                href={START_LOGIN_HREF}
                className="group flex items-center justify-between gap-4 rounded-xl border-2 bg-white p-4 text-left transition-shadow hover:shadow-sm"
                style={{ borderColor: ACCENT }}
              >
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: ACCENT }}
                  >
                    Today
                  </p>
                  <p className="mt-1 text-xl font-semibold text-black">
                    $5 <span className="text-xs font-normal text-gray-400">activation</span>
                  </p>
                  <p className="text-[11px] text-gray-500">Unlocks platform · 3 days full access</p>
                </div>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-transform group-hover:translate-x-0.5"
                  style={{ backgroundColor: ACCENT }}
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" {...STROKE} className="h-4 w-4">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </a>

              {/* Arrow */}
              <div
                className="hidden items-center justify-center text-gray-300 sm:flex"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" {...STROKE} className="h-4 w-4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>

              {/* Step 2 — $199/mo auto-starts */}
              <div className="flex items-center justify-between gap-4 rounded-xl bg-black p-4 text-left text-white">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Day 4
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    $199<span className="text-xs font-normal text-gray-400">/mo</span>
                  </p>
                  <p className="text-[11px] text-gray-400">Pro auto-starts · cancel anytime</p>
                </div>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-700 text-gray-300"
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" {...STROKE} className="h-4 w-4">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15 14" />
                  </svg>
                </span>
              </div>

              {/* Plus */}
              <div
                className="hidden items-center justify-center text-gray-300 sm:flex"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" {...STROKE} className="h-4 w-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>

              {/* Step 3 — Usage on top */}
              <Link
                href="#pricing"
                className="group flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-sm"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Usage
                  </p>
                  <p className="mt-1 text-xl font-semibold text-black">
                    From $0.06<span className="text-xs font-normal text-gray-400">/min</span>
                  </p>
                  <p className="text-[11px] text-gray-500">Only what you actually use</p>
                </div>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" {...STROKE} className="h-4 w-4">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </Link>
            </div>

            <p className="mt-4 text-center text-[11px] text-gray-400">
              No long trial. No contracts.
              <span className="mx-1.5 text-gray-300" aria-hidden>·</span>
              Cancel inside the 3-day window and you&apos;re never billed the $199.
            </p>
          </div>
        </section>

        {/* ============= PROBLEM ============= */}
        <section className="border-t border-gray-100 bg-gray-50/60 px-6 py-24">
          <div className="mx-auto max-w-[720px]">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              The problem
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              The call you miss is rarely the only thing you lose.
            </h2>
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-gray-600">
              <p>
                Most businesses do not lose customers because their service is poor.
              </p>
              <p className="font-medium text-black">
                They lose them because the moment failed.
              </p>
              <ul className="space-y-2">
                {[
                  "The phone rang while someone was busy.",
                  "The inquiry came in after hours.",
                  "The follow-up happened too late.",
                  "The caller moved on.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-3 h-1 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: ACCENT }}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p>That is all it takes.</p>
              <p className="font-medium text-black">
                SmartLine fixes that first moment — the one that decides whether the conversation
                continues or disappears.
              </p>
            </div>
          </div>
        </section>

        {/* ============= PROMISE ============= */}
        <section className="border-t border-gray-100 px-6 py-24">
          <div className="mx-auto max-w-[720px]">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              The promise
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Not a chatbot. Not a call center. Your own AI phone agent.
            </h2>
            <p className="mt-6 text-lg text-gray-600">
              SmartLine is built for businesses that want speed without the usual friction.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "No sales call just to test it.",
                "No long setup project.",
                "No \u201Cbook a demo to see pricing.\u201D",
                "No 30-day trial trap \u2014 a fast 3-day window, then one clear price.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-3 text-gray-600">
                  <X className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
              <div className="space-y-3">
                {[
                  "You activate the platform.",
                  "You add your business details.",
                  "You choose a voice.",
                  "You connect your number.",
                  "And your agent can start taking calls.",
                ].map((line) => (
                  <div key={line} className="flex items-start gap-3 text-black">
                    <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-gray-500">That is the difference.</p>
            </div>
          </div>
        </section>

        {/* ============= WHAT IT DOES ============= */}
        <section className="border-t border-gray-100 bg-gray-50/60 px-6 py-24">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto max-w-[720px] text-center">
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                What it does
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                What your agent can actually do
              </h2>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {/* Inbound */}
              <div className="rounded-2xl border border-gray-200 bg-white p-7">
                <Icon label="Inbound calls">
                  <svg viewBox="0 0 24 24" {...STROKE}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.73 2.79a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.89.36 1.83.6 2.79.73a2 2 0 0 1 1.72 2z" />
                  </svg>
                </Icon>
                <h3 className="mt-5 text-lg font-semibold">For inbound calls</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
                  {[
                    "Answer 24/7 in a natural, human voice.",
                    "Know your business from your profile, documents, or website.",
                    "Qualify leads.",
                    "Answer common questions.",
                    "Book appointments.",
                    "Transfer to a human when needed.",
                    "Record, transcribe, and summarize every call automatically.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Outbound */}
              <div className="rounded-2xl border border-gray-200 bg-white p-7">
                <Icon label="Outbound campaigns">
                  <svg viewBox="0 0 24 24" {...STROKE}>
                    <path d="M3 11l18-8-8 18-2-8-8-2z" />
                  </svg>
                </Icon>
                <h3 className="mt-5 text-lg font-semibold">For outbound campaigns</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
                  {[
                    "Upload a CSV and launch a calling campaign.",
                    "Call new leads within minutes.",
                    "Follow up missed opportunities automatically.",
                    "Send appointment reminders.",
                    "Detect voicemail and drop custom messages.",
                    "Respect timezone windows, throttling, retry logic, and compliance rules.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Messaging */}
              <div className="rounded-2xl border border-gray-200 bg-white p-7">
                <Icon label="Messaging and knowledge">
                  <svg viewBox="0 0 24 24" {...STROKE}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </Icon>
                <h3 className="mt-5 text-lg font-semibold">For messaging and knowledge</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
                  {[
                    "Continue the thread over SMS.",
                    "Support chat messaging.",
                    "Use uploaded documents or a structured business profile.",
                    "Stay current when your information changes.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============= WHY IT CONVERTS ============= */}
        <section className="border-t border-gray-100 px-6 py-24">
          <div className="mx-auto max-w-[720px]">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              Why it converts
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              The easiest way to buy a phone agent should also be the easiest way to use one.
            </h2>
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-gray-600">
              <p>
                Most platforms make you work too hard before they let you find out whether the thing
                is useful.
              </p>
              <p className="font-medium text-black">SmartLine does the opposite.</p>
              <p>It lowers the friction at the start, then earns the right to grow with you.</p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                { n: "1", t: "Start with a small real payment." },
                { n: "2", t: "Use real credits." },
                { n: "3", t: "See it work in your own business." },
                { n: "4", t: "Keep it only if it earns its place." },
              ].map((item) => (
                <div
                  key={item.n}
                  className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      color: ACCENT,
                      backgroundColor: "rgba(0, 102, 255, 0.1)",
                    }}
                  >
                    {item.n}
                  </span>
                  <span className="text-sm font-medium text-black">{item.t}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============= SETUP / HOW ============= */}
        <section id="how" className="border-t border-gray-100 bg-gray-50/60 px-6 py-24">
          <div className="mx-auto max-w-[820px]">
            <div className="text-center">
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                Setup
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Live in 5 minutes
              </h2>
            </div>

            <ol className="mt-14 space-y-5">
              {[
                {
                  n: "01",
                  title: "Tell SmartLine about your business",
                  desc: "Fill out your business profile or upload a document.",
                },
                {
                  n: "02",
                  title: "Pick a voice",
                  desc: "Choose the voice that fits your brand.",
                },
                {
                  n: "03",
                  title: "Give it tools",
                  desc: "Let it book, send SMS, transfer calls, or use your knowledge base.",
                },
                {
                  n: "04",
                  title: "Connect your number",
                  desc: "Keep your current number with call forwarding, or port it over completely.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="flex items-start gap-5 rounded-2xl border border-gray-200 bg-white p-6 sm:p-7"
                >
                  <span
                    className="text-2xl font-semibold tabular-nums"
                    style={{ color: ACCENT }}
                  >
                    {step.n}
                  </span>
                  <div>
                    <p className="font-semibold text-black">{step.title}</p>
                    <p className="mt-1 text-gray-600">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-10 text-center text-lg text-gray-600">
              The fastest way to understand SmartLine is not to read more about it.
              <br />
              <span className="font-medium text-black">It is to turn it on.</span>
            </p>

            <div className="mt-8 flex justify-center">
              <a
                href={START_LOGIN_HREF}
                className={buttonClasses({ size: "lg" })}
              >
                Start for $5 — 3 days full access
              </a>
            </div>
          </div>
        </section>

        {/* ============= PRICING ============= */}
        <section id="pricing" className="border-t border-gray-100 px-6 py-24">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto max-w-[720px] text-center">
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                Pricing
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Start for $5. Not $500.
              </h2>
            </div>

            <p className="mx-auto mt-4 max-w-[560px] text-center text-gray-600">
              One simple flow: $5 today, 3 days full access, then $199/mo — with usage billed on
              top of whatever your agent actually does.
            </p>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {/* Step 1 — Activation */}
              <div className="rounded-2xl border-2 p-7" style={{ borderColor: ACCENT }}>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-black">
                    Step 1 · Today
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: "rgba(0, 102, 255, 0.1)", color: ACCENT }}
                  >
                    Start here
                  </span>
                </div>
                <p className="mt-4 text-5xl font-semibold tracking-tight">
                  $5<span className="text-lg font-normal text-gray-400"> activation</span>
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Unlocks the platform immediately and gives you 3 days of full Pro access.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
                  {[
                    "One-time charge, billed today.",
                    "Full Pro capabilities for 72 hours.",
                    "Converts to credits you can use on usage.",
                    "No surprise charges during the window.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={START_LOGIN_HREF}
                  className={buttonClasses({ className: "mt-6 w-full" })}
                >
                  Activate now
                </a>
              </div>

              {/* Step 2 — Pro auto-starts */}
              <div className="relative rounded-2xl border border-gray-200 bg-black p-7 text-white">
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  Main plan
                </span>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Step 2 · Day 4
                </p>
                <p className="mt-4 text-5xl font-semibold tracking-tight">
                  $199<span className="text-lg font-normal text-gray-500">/mo</span>
                </p>
                <p className="mt-2 text-sm text-gray-300">
                  Pro starts automatically after the 3-day window. Cancel any time before then and
                  you are never billed the $199.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-gray-300">
                  {[
                    "3 AI agents",
                    "10 phone numbers",
                    "100 knowledge-base documents",
                    "5 GB storage",
                    "Priority support",
                    "Cancel anytime · month to month",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={START_LOGIN_HREF}
                  className={buttonClasses({
                    className:
                      "mt-6 w-full bg-white text-black hover:bg-gray-100",
                  })}
                >
                  Start for $5 →
                </a>
                <p className="mt-2 text-center text-xs text-gray-400">
                  Pay $5 now · Pro auto-starts day 4
                </p>
              </div>

              {/* Step 3 — Usage on top */}
              <div className="rounded-2xl border border-gray-200 p-7">
                <p className="text-xs font-semibold uppercase tracking-widest text-black">
                  Step 3 · On top
                </p>
                <p className="mt-4 text-5xl font-semibold tracking-tight">
                  Usage<span className="text-lg font-normal text-gray-400"> billed</span>
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Pro includes capacity. Voice minutes, SMS and phone numbers are billed on top,
                  at cost plus a small margin.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-gray-700">
                  {[
                    ["AI voice conversation", "$0.06/min"],
                    ["Inbound call", "$0.026/min"],
                    ["Outbound call", "$0.034/min"],
                    ["SMS", "$0.01/segment"],
                    ["Chat message", "$0.002/message"],
                    ["Phone number", "$1.80/month"],
                  ].map(([label, price]) => (
                    <li key={label} className="flex items-center justify-between">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium text-black tabular-nums">{price}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500">
                  5-minute inbound call ≈ <span className="font-medium text-black">$0.60</span>.
                  200 three-minute calls/month ≈{" "}
                  <span className="font-medium text-black">$55</span> on top of $199.
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-black">
                    Credit packs
                  </p>
                  <p className="mt-1 text-gray-600">Top up when you need to.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["$25", "$50", "$100", "$250"].map((pack) => (
                    <span
                      key={pack}
                      className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-black"
                    >
                      {pack}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-3">
              <a
                href={START_LOGIN_HREF}
                className={buttonClasses({ size: "lg" })}
              >
                Start for $5 — 3 days full access
              </a>
              <p className="text-xs text-gray-500">
                $5 today · $199/mo auto-starts on day 4 · cancel anytime before to owe nothing more.
              </p>
            </div>
          </div>
        </section>

        {/* ============= COMPARISON ============= */}
        <section className="border-t border-gray-100 bg-gray-50/60 px-6 py-24">
          <div className="mx-auto max-w-[900px]">
            <div className="mx-auto max-w-[720px] text-center">
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                Comparison
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Why SmartLine beats the usual alternatives
              </h2>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-7">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  The usual way
                </p>
                <p className="mt-2 font-semibold text-black">Asks for too much too early.</p>
                <ul className="mt-5 space-y-3 text-sm text-gray-600">
                  {[
                    "Weeks of setup.",
                    "Sales calls before access.",
                    "Monthly minimums before proof.",
                    "Outbound hidden behind enterprise upgrades.",
                    "Contract language before real value.",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="rounded-2xl border-2 bg-white p-7"
                style={{ borderColor: ACCENT }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: ACCENT }}
                >
                  SmartLine
                </p>
                <p className="mt-2 font-semibold text-black">Is different.</p>
                <ul className="mt-5 space-y-3 text-sm text-gray-700">
                  {[
                    "Live in minutes.",
                    "Self-serve from the first click.",
                    "Outbound included.",
                    "Forward your number or port it.",
                    "$5 today, $199/mo starting day 4.",
                    "Cancel anytime · no contract.",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mx-auto mt-10 max-w-[720px] text-center text-lg text-gray-600">
              The easiest product to start is often the one that gets tested.
              <br />
              <span className="font-medium text-black">
                The one that gets tested is the one that gets adopted.
              </span>
            </p>
          </div>
        </section>

        {/* ============= COST ANGLE ============= */}
        <section className="border-t border-gray-100 px-6 py-24">
          <div className="mx-auto max-w-[720px]">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              Cost angle
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              One saved call can pay for months.
            </h2>

            <p className="mt-8 text-lg text-gray-600">
              A receptionist costs money whether the phone rings or not. SmartLine costs almost
              nothing to start, and scales with actual usage.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "No sick days.",
                "No turnover.",
                "No training cycle.",
                "No one-call-at-a-time bottleneck.",
                "No dead hours where nobody answers.",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                  <span className="text-sm text-black">{line}</span>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-lg text-gray-600">
              For many businesses, one booked appointment or one recovered lead can pay for months
              of usage.
            </p>
          </div>
        </section>

        {/* ============= TRUST ============= */}
        <section className="border-t border-gray-100 bg-black px-6 py-24 text-white">
          <div className="mx-auto max-w-[900px]">
            <div className="mx-auto max-w-[720px] text-center">
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                Trust
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Serious where it matters.
              </h2>
              <p className="mt-6 text-lg text-gray-300">
                SmartLine is built to feel simple on the front end and serious on the back end.
              </p>
            </div>

            <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Isolated architecture",
                "Dedicated Twilio sub-account",
                "Dedicated OpenAI project",
                "Row-level database security",
                "PII redaction in transcripts",
                "Audit logs",
                "Consent tracking",
                "Abuse protection",
                "Export and deletion controls",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-gray-800 bg-white/[0.03] p-4"
                >
                  <Check className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-10 max-w-[640px] text-center text-lg text-gray-300">
              This is not a toy with a pretty voice. It is a real business system with a very
              low-friction starting point.
            </p>
          </div>
        </section>

        {/* ============= WHO IT IS FOR ============= */}
        <section className="border-t border-gray-100 px-6 py-24">
          <div className="mx-auto max-w-[820px]">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              Who it is for
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for businesses that cannot afford to sound unavailable.
            </h2>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                "Solo professionals who miss calls while serving clients.",
                "Service businesses that need jobs booked after hours.",
                "Clinics and spas that want fewer missed inquiries and fewer no-shows.",
                "Agencies and coaches that need fast lead follow-up.",
                "Startups that want inbound qualification without building a full team.",
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-black"
                >
                  {line}
                </div>
              ))}
            </div>

            <p className="mt-10 text-lg font-medium text-black">
              If a live conversation matters to your revenue, SmartLine matters to your business.
            </p>
          </div>
        </section>

        {/* ============= FAQ ============= */}
        <section id="faq" className="border-t border-gray-100 bg-gray-50/60 px-6 py-24">
          <div className="mx-auto max-w-[820px]">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              FAQ
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Questions people ask right before they decide
            </h2>

            <div className="mt-10 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
              {[
                {
                  q: "What exactly does the $5 do?",
                  a: "It charges $5 today, unlocks the platform immediately, and gives you 3 days of full Pro access. That $5 also becomes usage credits you can spend on voice minutes, SMS or phone numbers.",
                },
                {
                  q: "When am I billed the $199/month?",
                  a: "On day 4, right after the 3-day window ends. The subscription is month to month from there. You can cancel inside the 3-day window and you are never billed the $199. Launch testers: enter code TESTER at Stripe Checkout for $150 off your first month ($49 instead of $199). The $5 activation stays $5.",
                },
                {
                  q: "Is there a longer free trial?",
                  a: "No. We keep it to 3 days on purpose \u2014 long enough to prove it works on a real phone line, short enough that we aren\u2019t pretending the product is free. That\u2019s why the $5 exists.",
                },
                {
                  q: "Can I keep my current number?",
                  a: "Yes. Forward it in seconds, or port it fully if you want SmartLine to own the line.",
                },
                {
                  q: "Can it do outbound too?",
                  a: "Yes. Outbound campaigns, lead follow-up, reminders, and voicemail drop are built in.",
                },
                {
                  q: "Will it sound robotic?",
                  a: "No. SmartLine uses modern real-time AI voice, not old-style text-to-speech.",
                },
                {
                  q: "What if I want to stop?",
                  a: "Cancel from your account in one click. Stop inside the 3-day window and you are never billed the $199. Stop after that and the current month finishes out \u2014 no clawback, no contract.",
                },
                {
                  q: "What about my data?",
                  a: "Your data remains yours. Export it. Delete it. Keep control.",
                },
              ].map((item) => (
                <details key={item.q} className="group p-6 sm:p-7">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                    <span className="font-semibold text-black">{item.q}</span>
                    <span
                      aria-hidden
                      className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-transform group-open:rotate-45"
                    >
                      <svg viewBox="0 0 24 24" {...STROKE} className="h-3.5 w-3.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 text-gray-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============= FINAL CLOSE ============= */}
        <section className="relative overflow-hidden border-t border-gray-100 px-6 py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[360px] max-w-[1000px]"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 0%, rgba(0,102,255,0.1) 0%, rgba(0,102,255,0) 70%)",
            }}
          />
          <div className="relative mx-auto max-w-[720px] text-center">
            <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              The smartest way to test an AI phone agent is to put it on the line.
            </h2>

            <div className="mt-10 space-y-2 text-lg text-gray-600">
              <p>Not after a sales process.</p>
              <p>Not after a contract.</p>
              <p>Not after a long implementation.</p>
              <p className="pt-2 text-2xl font-semibold text-black">Now.</p>
            </div>

            <div className="mt-10 space-y-2 text-lg text-gray-600">
              <p>Start for $5.</p>
              <p>Use real credits.</p>
              <p>See how it handles your business.</p>
              <p>
                <span className="font-medium text-black">Keep it because it works.</span>
              </p>
            </div>

            <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={START_LOGIN_HREF}
                className={buttonClasses({
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                Start for $5
              </a>
              <a href={hearHref} className={hearClass}>
                Hear It Talk
              </a>
            </div>

            <p className="mt-8 text-sm text-gray-500">
              The first saved call could pay for the next hundred.
            </p>
          </div>
        </section>
      </main>

      {/* ============= FOOTER ============= */}
      <footer className="border-t border-gray-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ACCENT }}
                aria-hidden
              />
              <span className="text-sm font-semibold">SmartLine</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
              <Link href="/terms" className="hover:text-black">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-black">Privacy Policy</Link>
              <a href="mailto:support@leadagentsstudio.com" className="hover:text-black">
                support@leadagentsstudio.com
              </a>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
            Powered by OpenAI · Twilio · Enterprise-grade infrastructure · GDPR + TCPA ready
          </div>

          <div className="mt-3 text-center text-xs text-gray-400">
            &copy; 2026 SmartLine
          </div>
        </div>
      </footer>
    </div>
  );
}
