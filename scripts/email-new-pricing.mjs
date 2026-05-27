#!/usr/bin/env node
import "dotenv/config";
import postgres from "postgres";

const args = new Set(process.argv.slice(2));
const shouldSend = args.has("--send");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const toArg = process.argv.find((arg) => arg.startsWith("--to="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const explicitTo = toArg
  ? toArg
      .split("=")[1]
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  : [];

const databaseUrl = process.env.DATABASE_URL;
const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
const from =
  process.env.MAILGUN_FROM ||
  process.env.AUTH_EMAIL_FROM ||
  "SmartLine <billing@smartlineagent.com>";
const replyTo = process.env.SUPPORT_EMAIL || "support@smartlineagent.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://smartlineagent.com";

if (!databaseUrl && explicitTo.length === 0) {
  console.error("Missing DATABASE_URL. Use --to=email@example.com to send a test without DB.");
  process.exit(1);
}

if (shouldSend && (!mailgunApiKey || !mailgunDomain)) {
  console.error("Missing MAILGUN_API_KEY or MAILGUN_DOMAIN.");
  process.exit(1);
}

const subject = "SmartLine pricing is simpler now";

function bodyText(email) {
  return [
    "Hi,",
    "We simplified SmartLine pricing so it is easier to start testing real calls without a big first commitment.",
    "The new plans are:",
    "Starter — $49/mo: 1 agent, 1 number, 100 included minutes.",
    "Growth — $149/mo: 3 agents, 3 numbers, 500 included minutes.",
    "Scale — $299/mo: 10 agents, 10 numbers, 2,000 included minutes, routing, and analytics.",
    "Each plan starts with a 7-day trial and includes $4 in usage credits for test calls. Usage credits are still separate for phone numbers, SMS, voice minutes, and paid API usage, so you only top up when you need more usage.",
    `See billing: ${appUrl}/billing`,
    `Sign in: ${appUrl}/login?email=${encodeURIComponent(email)}`,
    "Reply to this email if you want help choosing the right plan.",
    "SmartLine",
  ].join("\n\n");
}

function bodyHtml(email) {
  return bodyText(email)
    .split("\n\n")
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

async function getRecipients() {
  if (explicitTo.length > 0) return explicitTo;

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql`
      select distinct lower(u.email) as email
      from users u
      inner join org_memberships om on om.user_id = u.id
      inner join organizations o on o.id = om.org_id
      where u.email is not null
      order by email asc
      ${limit ? sql`limit ${limit}` : sql``}
    `;
    return rows.map((row) => row.email).filter(Boolean);
  } finally {
    await sql.end();
  }
}

async function sendMailgun(to) {
  const params = new URLSearchParams({
    from,
    to,
    subject,
    text: bodyText(to),
    html: bodyHtml(to),
    "h:Reply-To": replyTo,
  });

  const res = await fetch(
    `${mailgunApiBaseUrl}/v3/${encodeURIComponent(mailgunDomain)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  if (!res.ok) {
    throw new Error(`Mailgun ${res.status}: ${await res.text()}`);
  }
}

const recipients = await getRecipients();

console.log(
  `${shouldSend ? "Sending" : "Dry run"} pricing email to ${recipients.length} recipient(s).`
);
console.log(`From: ${from}`);
console.log(`Subject: ${subject}`);

if (!shouldSend) {
  console.log("\nPreview recipient list:");
  for (const email of recipients.slice(0, 25)) console.log(`- ${email}`);
  if (recipients.length > 25) console.log(`...and ${recipients.length - 25} more`);
  console.log("\nPreview body:\n");
  console.log(bodyText(recipients[0] || "customer@example.com"));
  console.log("\nRun with --send to send for real.");
  process.exit(0);
}

for (const email of recipients) {
  await sendMailgun(email);
  console.log(`Sent ${email}`);
}
