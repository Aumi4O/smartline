import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

/**
 * Shows a loud, actionable warning if the env vars that make phone calls
 * work aren't set yet. Silent when everything is wired so we don't nag
 * in the normal case.
 */
export function VoiceReadinessCard() {
  const checks = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_SIP_PROJECT_ID: !!process.env.OPENAI_SIP_PROJECT_ID,
    OPENAI_WEBHOOK_SECRET: !!process.env.OPENAI_WEBHOOK_SECRET,
    TWILIO_MASTER_CREDS:
      !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
  };

  const ready = Object.values(checks).every(Boolean);
  if (ready) return null;

  const missing: Array<{ key: string; fix: string }> = [];
  if (!checks.OPENAI_API_KEY)
    missing.push({
      key: "OPENAI_API_KEY",
      fix: "Paste your OpenAI API key into Vercel → Environment Variables.",
    });
  if (!checks.OPENAI_SIP_PROJECT_ID)
    missing.push({
      key: "OPENAI_SIP_PROJECT_ID",
      fix: "Copy the Project ID (proj_...) from OpenAI Platform → Settings → Project, then paste into Vercel → Environment Variables.",
    });
  if (!checks.OPENAI_WEBHOOK_SECRET)
    missing.push({
      key: "OPENAI_WEBHOOK_SECRET",
      fix: "In OpenAI Platform → Webhooks, add https://smartlineagent.com/api/openai/sip-webhook subscribed to realtime.call.incoming, then copy the signing secret to Vercel.",
    });
  if (!checks.TWILIO_MASTER_CREDS)
    missing.push({
      key: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN",
      fix: "Paste your Twilio master-account credentials into Vercel → Environment Variables.",
    });

  return (
    <Card className="mt-4 border-red-300 bg-red-50/50">
      <CardHeader>
        <CardTitle className="text-red-700">
          Voice isn&apos;t ready — your agent will say &quot;not yet ready, call later&quot;
        </CardTitle>
        <CardDescription className="text-red-600">
          Calls can only connect once all of these are set on Vercel and the deploy has gone live.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-red-800">
          {missing.map((m) => (
            <li key={m.key}>
              <span className="font-mono font-semibold">{m.key}</span>
              <span className="ml-2 text-red-700">— {m.fix}</span>
            </li>
          ))}
          <li className="text-red-700">
            After adding the vars, click <strong>Redeploy</strong> in Vercel. This page will go green.
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
