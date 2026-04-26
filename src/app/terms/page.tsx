import Link from "next/link";

export const metadata = {
  title: "Terms of Service — SmartLine",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">SmartLine</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-black">Sign In</Link>
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-12">
        <h1 className="text-3xl font-semibold text-black">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: April 14, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600">
          <section>
            <h2 className="text-lg font-semibold text-black">1. Acceptance of Terms</h2>
            <p>By accessing or using SmartLine (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including subscribers, visitors, and API consumers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">2. Description of Service</h2>
            <p>SmartLine provides AI-powered voice agents for businesses. The Service includes phone call handling, outbound calling campaigns, lead management, SMS responses, and related features. The Service uses third-party providers including OpenAI for AI processing and Twilio for telephony.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">3. Account Registration</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old and have the legal authority to bind your organization. One person or entity may not maintain more than one account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">4. Billing and Payment</h2>
            <p>To activate the platform you load a one-time $5.00 USD starter credit pack. The full $5 is credited to your account as usage credits — it is not a service fee or activation fee paid to SmartLine. Usage (voice minutes, SMS, phone numbers, API) is billed on a pay-as-you-go basis and deducted from your credit balance. Credits are non-refundable but expire only on account closure. The optional Pro subscription is billed separately at $199/month and can be cancelled at any time. Prices may change with 30 days notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">5. Acceptable Use</h2>
            <p>You agree not to use the Service to: (a) violate any laws including TCPA, GDPR, and CCPA; (b) make unsolicited calls without proper consent; (c) transmit harmful, abusive, or fraudulent content; (d) impersonate any person or entity; (e) interfere with or disrupt the Service; (f) use the Service for any illegal purpose. We reserve the right to suspend accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">6. Call Recording and Consent</h2>
            <p>Calls handled by the Service may be recorded and transcribed for quality assurance and to provide call summaries. A disclosure is played at the beginning of each call. You are responsible for ensuring compliance with all applicable call recording laws in your jurisdiction. By using outbound calling features, you warrant that you have obtained proper consent from recipients.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">7. TCPA Compliance</h2>
            <p>For outbound calling, you are responsible for compliance with the Telephone Consumer Protection Act (TCPA). The Service includes built-in safeguards such as permitted calling hours (8am-9pm local time), do-not-call list management, and call frequency limits. However, ultimate compliance responsibility rests with you.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">8. Intellectual Property</h2>
            <p>You retain ownership of your business data, knowledge base content, and custom agent configurations. SmartLine retains ownership of the Service, its technology, and all related intellectual property. You grant SmartLine a limited license to process your data solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">9. Data Handling</h2>
            <p>We process your data in accordance with our Privacy Policy. Call transcripts and recordings are retained according to your configured data retention period (default: 90 days). You may request data deletion at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">10. Limitation of Liability</h2>
            <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND. SMARTLINE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">11. Service Availability</h2>
            <p>We strive for high availability but do not guarantee uninterrupted service. The Service depends on third-party providers (Twilio, OpenAI) whose availability is outside our control. We are not liable for downtime caused by third-party service disruptions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">12. Termination</h2>
            <p>Either party may terminate at any time. Upon termination, your access to the Service will cease and your data will be deleted after the retention period. Any remaining credits are non-refundable upon voluntary termination.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">13. Changes to Terms</h2>
            <p>We may update these terms from time to time. Material changes will be communicated via email or in-app notification at least 30 days before taking effect. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">14. Governing Law</h2>
            <p>These terms are governed by the laws of the State of Delaware, United States. Any disputes shall be resolved in the courts of Delaware.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black">15. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:legal@smartline.ai" className="text-black underline">legal@smartline.ai</a>.</p>
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
