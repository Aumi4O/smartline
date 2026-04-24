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
  const sipProject = process.env.OPENAI_SIP_PROJECT_ID?.trim() || "";
  const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET?.trim() || "";

  const hasOpenAIKey = apiKey.length > 0;
  const hasSipProject = sipProject.length > 0;
  const hasWebhookSecret = webhookSecret.length > 0;
  const hasTwilio =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || null;

  // Format checks — people paste in the wrong thing more often than not.
  const apiKeyFormat = hasOpenAIKey && apiKey.startsWith("sk-");
  const sipProjectFormat = hasSipProject && sipProject.startsWith("proj_");
  const webhookSecretFormat = hasWebhookSecret && webhookSecret.startsWith("whsec_");

  const ready =
    hasOpenAIKey &&
    hasSipProject &&
    hasWebhookSecret &&
    hasTwilio &&
    apiKeyFormat &&
    sipProjectFormat &&
    webhookSecretFormat;

  return NextResponse.json({
    ready,
    checks: {
      OPENAI_API_KEY: hasOpenAIKey,
      OPENAI_API_KEY_format_ok: apiKeyFormat,
      OPENAI_SIP_PROJECT_ID: hasSipProject,
      OPENAI_SIP_PROJECT_ID_format_ok: sipProjectFormat,
      OPENAI_WEBHOOK_SECRET: hasWebhookSecret,
      OPENAI_WEBHOOK_SECRET_format_ok: webhookSecretFormat,
      TWILIO_MASTER_CREDS: hasTwilio,
    },
    webhook: {
      url: appUrl ? `${appUrl}/api/openai/sip-webhook` : null,
      note: "Paste this URL in OpenAI Platform → Webhooks and subscribe to realtime.call.incoming",
    },
    fix: ready
      ? null
      : missingSteps({
          hasOpenAIKey,
          hasSipProject,
          hasWebhookSecret,
          hasTwilio,
          apiKeyFormat,
          sipProjectFormat,
          webhookSecretFormat,
        }),
  });
}

function missingSteps(s: {
  hasOpenAIKey: boolean;
  hasSipProject: boolean;
  hasWebhookSecret: boolean;
  hasTwilio: boolean;
  apiKeyFormat: boolean;
  sipProjectFormat: boolean;
  webhookSecretFormat: boolean;
}): string[] {
  const steps: string[] = [];
  if (!s.hasOpenAIKey) steps.push("Set OPENAI_API_KEY in Vercel → Environment Variables");
  else if (!s.apiKeyFormat)
    steps.push("OPENAI_API_KEY should start with sk-. You likely pasted the wrong value.");

  if (!s.hasSipProject)
    steps.push(
      "Set OPENAI_SIP_PROJECT_ID to your OpenAI project id (proj_...) — find it in OpenAI Platform → Settings → Project"
    );
  else if (!s.sipProjectFormat)
    steps.push(
      "OPENAI_SIP_PROJECT_ID must start with proj_. You probably pasted the org id (org-...) or the project name. Grab the ID at platform.openai.com/settings/organization/projects."
    );

  if (!s.hasWebhookSecret)
    steps.push(
      "Set OPENAI_WEBHOOK_SECRET to the signing secret from OpenAI Platform → Webhooks"
    );
  else if (!s.webhookSecretFormat)
    steps.push(
      "OPENAI_WEBHOOK_SECRET must start with whsec_. Regenerate the signing secret in OpenAI Platform → Webhooks and paste the full value."
    );

  if (!s.hasTwilio) steps.push("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN");
  if (steps.length > 0) steps.push("Redeploy so the new env vars take effect");
  return steps;
}
