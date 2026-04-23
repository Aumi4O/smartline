import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — SmartLine",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">SmartLine</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-black">Sign In</Link>
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-12">
        <h1 className="text-3xl font-semibold text-black">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: April 14, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600">
          <section>
            <h2 className="text-lg font-semibold text-black">1. Introduction</h2>
            <p>SmartLine (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI voice agent platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">2. Information We Collect</h2>
            <p><strong>Account Information:</strong> Name, email address, and authentication credentials when you register.</p>
            <p><strong>Business Information:</strong> Business name, industry, services, hours, pricing, and FAQ that you provide to train your AI agent.</p>
            <p><strong>Call Data:</strong> Phone numbers of callers, call duration, call recordings, and transcripts generated during calls handled by the Service.</p>
            <p><strong>Lead Data:</strong> Contact information (names, phone numbers, emails, companies) that you upload or enter for outbound campaigns.</p>
            <p><strong>Usage Data:</strong> API usage, feature usage, billing transactions, and interaction logs.</p>
            <p><strong>Technical Data:</strong> IP addresses, browser type, device information, and cookies for authentication and analytics.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">3. How We Use Your Information</h2>
            <p>We use your information to: (a) provide and operate the Service; (b) process calls and generate AI responses using your business knowledge; (c) calculate billing and deduct usage credits; (d) send transactional communications (billing receipts, account alerts); (e) improve the Service and fix bugs; (f) comply with legal obligations; (g) detect and prevent fraud or abuse.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">4. Third-Party Processors</h2>
            <p>We share data with the following third-party processors solely to provide the Service:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>OpenAI</strong> — processes voice and text interactions for AI responses</li>
              <li><strong>Twilio</strong> — provides telephony infrastructure for calls and SMS</li>
              <li><strong>Stripe</strong> — processes payments and manages subscriptions</li>
              <li><strong>Supabase</strong> — hosts our database infrastructure</li>
              <li><strong>Vercel</strong> — hosts our application</li>
              <li><strong>Upstash</strong> — provides caching and job queue infrastructure</li>
            </ul>
            <p className="mt-2">Each processor is bound by data processing agreements and processes data only as instructed.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">5. Call Recording</h2>
            <p>Calls handled by the Service are recorded and transcribed. A disclosure is played at the beginning of each call informing the caller that the call may be recorded. Recordings and transcripts are stored for the duration of your configured data retention period (default: 90 days) and then permanently deleted. You can request immediate deletion of specific recordings at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">6. Data Retention</h2>
            <p>We retain your data as follows:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> retained while your account is active and for 30 days after deletion</li>
              <li><strong>Call recordings and transcripts:</strong> retained per your configured retention period (30, 60, 90, or 365 days)</li>
              <li><strong>Billing records:</strong> retained for 7 years for tax and legal compliance</li>
              <li><strong>Audit logs:</strong> retained for 1 year</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">7. Data Security</h2>
            <p>We implement industry-standard security measures including: encryption in transit (TLS 1.3) and at rest, encrypted API key storage, webhook signature verification, per-tenant data isolation, rate limiting, and regular security reviews. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">8. Your Rights (GDPR / CCPA)</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Access</strong> — request a copy of your personal data</li>
              <li><strong>Rectification</strong> — correct inaccurate data</li>
              <li><strong>Deletion</strong> — request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
              <li><strong>Objection</strong> — object to processing of your data</li>
              <li><strong>Restriction</strong> — request restriction of processing</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:privacy@smartline.ai" className="text-black underline">privacy@smartline.ai</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">9. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use advertising or tracking cookies. Essential cookies cannot be disabled as they are necessary for the Service to function.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">10. Children&apos;s Privacy</h2>
            <p>The Service is not intended for individuals under 18 years of age. We do not knowingly collect information from children. If we learn that we have collected data from a child, we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">11. International Transfers</h2>
            <p>Your data may be processed in the United States. By using the Service, you consent to the transfer of your data to the US. We ensure appropriate safeguards are in place for international data transfers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification at least 30 days before they take effect.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">13. Contact Us</h2>
            <p>For privacy-related questions or to exercise your rights:</p>
            <p className="mt-2">Email: <a href="mailto:privacy@smartline.ai" className="text-black underline">privacy@smartline.ai</a></p>
          </section>
        </div>
      </main>

      <footer className="flex h-14 items-center justify-center border-t border-gray-200 px-6">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>&copy; 2026 SmartLine</span>
          <Link href="/terms" className="hover:text-black">Terms</Link>
          <Link href="/privacy" className="hover:text-black">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
