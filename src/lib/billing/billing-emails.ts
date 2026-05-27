import { SUPPORT_EMAIL } from "@/lib/contact";
import {
  ACTIVATION_AMOUNT_CENTS,
  PRO_TRIAL_DAYS,
  type SubscriptionTierKey,
  centsToUsd,
  getSubscriptionTier,
} from "@/lib/pricing";

const resendApiKey = process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY;
const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
const billingEmailFrom =
  process.env.MAILGUN_FROM ??
  process.env.AUTH_EMAIL_FROM ??
  "SmartLine <onboarding@resend.dev>";

type BillingEmail = {
  to?: string | null;
  subject: string;
  text: string;
  html?: string;
};

function billingUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://smartlineagent.com";
  return `${appUrl}/billing`;
}

function tierLine(tierKey?: SubscriptionTierKey | string | null) {
  const tier = getSubscriptionTier(tierKey);
  return `${tier.name.replace("SmartLine ", "")} is ${centsToUsd(
    tier.monthlyPriceCents
  )}/mo`;
}

function toHtml(text: string) {
  return text
    .split("\n\n")
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export async function sendBillingEmail({ to, subject, text, html }: BillingEmail) {
  if (!to) return;

  if (mailgunApiKey && mailgunDomain) {
    await sendMailgunEmail({ to, subject, text, html });
    return;
  }

  if (!resendApiKey) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: billingEmailFrom,
        to,
        reply_to: SUPPORT_EMAIL,
        subject,
        text,
        html: html ?? toHtml(text),
      }),
    });

    if (!res.ok) {
      console.error("[billing-email] Resend error:", await res.text());
    }
  } catch (err) {
    console.error("[billing-email] send failed:", err);
  }
}

async function sendMailgunEmail({
  to,
  subject,
  text,
  html,
}: BillingEmail & { to: string }) {
  const body = new URLSearchParams({
    from: billingEmailFrom,
    to,
    subject,
    text,
    html: html ?? toHtml(text),
    "h:Reply-To": SUPPORT_EMAIL,
  });

  try {
    const res = await fetch(
      `${mailgunApiBaseUrl}/v3/${encodeURIComponent(mailgunDomain!)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString(
            "base64"
          )}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );

    if (!res.ok) {
      console.error("[billing-email] Mailgun error:", await res.text());
    }
  } catch (err) {
    console.error("[billing-email] Mailgun send failed:", err);
  }
}

export async function sendTrialStartedEmail(
  to: string | null | undefined,
  creditAmountCents = ACTIVATION_AMOUNT_CENTS,
  tierKey?: SubscriptionTierKey | string | null
) {
  await sendBillingEmail({
    to,
    subject: "Your SmartLine trial is active",
    text: [
      "Your SmartLine plan trial is active.",
      creditAmountCents > 0
        ? `${centsToUsd(creditAmountCents)} in usage credits has been loaded for calls, SMS and API usage.`
        : "You can add usage credits any time before running paid calls, SMS or API usage.",
      `Your ${PRO_TRIAL_DAYS}-day trial includes paid-plan access. After the trial, ${tierLine(tierKey)} unless you cancel before billing starts.`,
      `Manage billing: ${billingUrl()}`,
    ].join("\n\n"),
  });
}

export async function sendCreditPurchaseEmail(
  to: string | null | undefined,
  amountCents: number
) {
  await sendBillingEmail({
    to,
    subject: "SmartLine credits added",
    text: [
      `${centsToUsd(amountCents)} in SmartLine usage credits has been added to your account.`,
      "Credits are used for calls, SMS and API usage.",
      `Manage billing: ${billingUrl()}`,
    ].join("\n\n"),
  });
}

export async function sendSubscriptionStartedEmail(
  to: string | null | undefined,
  tierKey?: SubscriptionTierKey | string | null
) {
  await sendBillingEmail({
    to,
    subject: "Your SmartLine plan is active",
    text: [
      "Your SmartLine subscription is active.",
      `${tierLine(tierKey)} and renews automatically until cancelled.`,
      `Manage billing: ${billingUrl()}`,
    ].join("\n\n"),
  });
}

export async function sendTrialEndingEmail(
  to: string | null | undefined,
  tierKey?: SubscriptionTierKey | string | null
) {
  await sendBillingEmail({
    to,
    subject: "Your SmartLine plan trial ends soon",
    text: [
      "Your SmartLine plan trial is ending soon.",
      `After the trial, ${tierLine(tierKey)} unless you cancel before billing starts.`,
      `Manage billing: ${billingUrl()}`,
    ].join("\n\n"),
  });
}

export async function sendPaymentFailedEmail(to: string | null | undefined) {
  await sendBillingEmail({
    to,
    subject: "SmartLine payment failed",
    text: [
      "We could not process your latest SmartLine payment.",
      "Please update your payment method to keep paid-plan access and usage running.",
      `Manage billing: ${billingUrl()}`,
    ].join("\n\n"),
  });
}

export async function sendSubscriptionCancelledEmail(to: string | null | undefined) {
  await sendBillingEmail({
    to,
    subject: "SmartLine plan was cancelled",
    text: [
      "Your SmartLine subscription was cancelled.",
      "Your workspace remains on Starter with any remaining credits still available for eligible usage.",
      `Manage billing: ${billingUrl()}`,
    ].join("\n\n"),
  });
}
