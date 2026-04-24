#!/usr/bin/env node
// Pushes all relevant env vars from .env.local to Vercel production.
// - Removes any existing (possibly empty) value first.
// - Overrides AUTH_URL + NEXT_PUBLIC_APP_URL to the production domain.
// - Skips any variable that is empty locally.
import dotenv from "dotenv";
import { spawn } from "node:child_process";

dotenv.config({ path: ".env.local" });

const PROD_DOMAIN = "https://smartlineagent.com";

const VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "OPENAI_API_KEY",
  "OPENAI_ADMIN_KEY",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_RESEND_KEY",
  "RESEND_API_KEY",
  "AUTH_EMAIL_FROM",
  "DATABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "R2_ENDPOINT",
];

const OVERRIDES = {
  AUTH_URL: PROD_DOMAIN,
  NEXT_PUBLIC_APP_URL: PROD_DOMAIN,
  NODE_ENV: "production",
};

function run(cmd, args, { stdin } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    if (stdin !== undefined) {
      p.stdin.write(stdin);
      p.stdin.end();
    }
    p.on("close", (code) => resolve({ code, out, err }));
  });
}

async function rm(name) {
  const { code } = await run("vercel", ["env", "rm", name, "production", "--yes"]);
  return code === 0;
}

async function add(name, value) {
  // value comes in via stdin so newlines/special chars are preserved
  const { code, err } = await run(
    "vercel",
    ["env", "add", name, "production"],
    { stdin: value }
  );
  if (code !== 0) {
    console.error(`   ❌ ${name} failed: ${err.trim().split("\n").slice(-3).join(" | ")}`);
    return false;
  }
  return true;
}

async function push(name, value) {
  if (!value) {
    console.log(`⏭  ${name} (empty locally, skipping)`);
    return;
  }
  process.stdout.write(`→ ${name} `);
  await rm(name);
  const ok = await add(name, value);
  console.log(ok ? "✅" : "");
}

console.log(`\nPushing env → Vercel production (${PROD_DOMAIN})\n`);

for (const [name, value] of Object.entries(OVERRIDES)) {
  await push(name, value);
}
for (const name of VARS) {
  await push(name, process.env[name]);
}

console.log("\n✅ Done. Next: vercel --prod\n");
