import { NextResponse } from "next/server";

/**
 * Public voice-readiness diagnostic.
 *
 * Returns booleans only — no secrets, no tenant data — so it's safe to
 * expose without auth. Purpose is exactly one thing: "can a call land
 * on a live agent right now, or is an env var missing?"
 *
 * Anyone can curl this to check. The dashboard also renders it as a
 * card so the operator doesn't have to paste a curl.
 */
export async function GET() {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasSipProject = !!process.env.OPENAI_SIP_PROJECT_ID;
  const hasWebhookSecret = !!process.env.OPENAI_WEBHOOK_SECRET;
  const hasTwilio =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || null;

  const ready = hasOpenAIKey && hasSipProject && hasWebhookSecret && hasTwilio;

  return NextResponse.json({
    ready,
    checks: {
      OPENAI_API_KEY: hasOpenAIKey,
      OPENAI_SIP_PROJECT_ID: hasSipProject,
      OPENAI_WEBHOOK_SECRET: hasWebhookSecret,
      TWILIO_MASTER_CREDS: hasTwilio,
    },
    webhook: {
      url: appUrl ? `${appUrl}/api/openai/sip-webhook` : null,
      note: "Paste this URL in OpenAI Platform → Webhooks and subscribe to realtime.call.incoming",
    },
    fix: ready
      ? null
      : missingSteps({ hasOpenAIKey, hasSipProject, hasWebhookSecret, hasTwilio }),
  });
}

function missingSteps(s: {
  hasOpenAIKey: boolean;
  hasSipProject: boolean;
  hasWebhookSecret: boolean;
  hasTwilio: boolean;
}): string[] {
  const steps: string[] = [];
  if (!s.hasOpenAIKey) steps.push("Set OPENAI_API_KEY in Vercel → Environment Variables");
  if (!s.hasSipProject)
    steps.push(
      "Set OPENAI_SIP_PROJECT_ID to your OpenAI project id (proj_...) — find it in OpenAI Platform → Settings → Project"
    );
  if (!s.hasWebhookSecret)
    steps.push(
      "Set OPENAI_WEBHOOK_SECRET to the signing secret from OpenAI Platform → Webhooks"
    );
  if (!s.hasTwilio)
    steps.push("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN");
  if (steps.length > 0) steps.push("Redeploy so the new env vars take effect");
  return steps;
}
