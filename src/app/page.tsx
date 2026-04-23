import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 px-6">
        <span className="text-lg font-semibold tracking-tight">SmartLine</span>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/login">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="max-w-[640px] text-center">
          <h1 className="text-5xl font-semibold leading-tight tracking-tight text-black">
            AI voice agents for your business
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Deploy an intelligent phone agent that answers calls, books appointments, and handles customer inquiries — 24/7. Set up in minutes, no code required.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/login">
              <Button size="lg">Get Started — $5</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            $5 activation deposit converts to real usage credits. Pay-as-you-go after that.
          </p>
        </div>

        {/* Features */}
        <div className="mt-20 grid max-w-[900px] gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200">
              <span className="text-lg">📞</span>
            </div>
            <h3 className="text-sm font-semibold text-black">Answers Every Call</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your AI agent picks up instantly — no hold music, no missed calls. Speaks naturally in English, Hebrew, Russian, and more.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200">
              <span className="text-lg">🧠</span>
            </div>
            <h3 className="text-sm font-semibold text-black">Knows Your Business</h3>
            <p className="mt-1 text-sm text-gray-500">
              Train the agent on your services, hours, pricing, and FAQ. It responds with accurate, personalized answers.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200">
              <span className="text-lg">💰</span>
            </div>
            <h3 className="text-sm font-semibold text-black">Pay As You Go</h3>
            <p className="mt-1 text-sm text-gray-500">
              No contracts, no monthly minimums. Only pay for the calls your agent handles. Start with $5 in credits.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20 max-w-[640px] text-center">
          <h2 className="text-2xl font-semibold text-black">Live in 5 minutes</h2>
          <div className="mt-8 space-y-6 text-left">
            {[
              { step: "1", title: "Sign up and activate", desc: "Create your account with Google or email. Pay a $5 deposit that becomes real credits." },
              { step: "2", title: "Describe your business", desc: "Fill in your services, hours, and FAQ. The agent builds its knowledge automatically." },
              { step: "3", title: "Get a phone number", desc: "Pick a local number. Your AI agent starts answering calls immediately." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-medium text-white">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-black">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-20 mb-20 max-w-[640px] text-center">
          <h2 className="text-2xl font-semibold text-black">Simple pricing</h2>
          <p className="mt-2 text-gray-500">No hidden fees. No contracts.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-6 text-left">
              <p className="text-xs font-medium text-gray-400">STARTER</p>
              <p className="mt-2 text-3xl font-semibold text-black">$5</p>
              <p className="text-sm text-gray-500">one-time activation</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li>$5 converts to usage credits</li>
                <li>1 AI agent</li>
                <li>1 phone number</li>
                <li>Pay-as-you-go usage</li>
                <li>Full call transcripts</li>
              </ul>
              <Link href="/login" className="mt-6 block">
                <Button className="w-full">Get Started</Button>
              </Link>
            </div>

            <div className="rounded-lg border-2 border-black p-6 text-left">
              <p className="text-xs font-medium text-gray-400">PRO</p>
              <p className="mt-2 text-3xl font-semibold text-black">$199<span className="text-base font-normal text-gray-400">/mo</span></p>
              <p className="text-sm text-gray-500">for growing businesses</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li>Everything in Starter</li>
                <li>3 AI agents</li>
                <li>10 phone numbers</li>
                <li>Priority support</li>
                <li>Analytics dashboard</li>
                <li>Webhook integrations</li>
              </ul>
              <Link href="/login" className="mt-6 block">
                <Button className="w-full" variant="secondary">Upgrade Later</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="flex h-14 items-center justify-center border-t border-gray-200 px-6">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>&copy; 2026 SmartLine</span>
          <Link href="/terms" className="hover:text-black">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-black">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
