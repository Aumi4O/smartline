#!/usr/bin/env bash
# Pushes production env vars to Vercel by reading values from .env.local
# (which is gitignored). This file is safe to commit.
#
# Usage:
#   bash scripts/push-env.sh
#
# Requires: vercel CLI logged in, project already linked.
set -e

cd "$(dirname "$0")/.."

if [ ! -f ".env.local" ]; then
  echo "❌ .env.local not found. Aborting."
  exit 1
fi

# Load all KEY=VALUE lines from .env.local (ignoring comments/blanks)
# shellcheck disable=SC1091
set -a
. <(grep -Ev '^\s*(#|$)' .env.local)
set +a

# Env vars to push to Vercel production, with per-environment overrides.
# Keys marked with OVERRIDE_* use that value instead of .env.local (so URLs
# point at production domain, not localhost).
PRODUCTION_URL="https://smartlineagent.com"

declare -a VARS=(
  STRIPE_SECRET_KEY
  STRIPE_PUBLISHABLE_KEY
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER
  OPENAI_API_KEY
  OPENAI_ADMIN_KEY
  AUTH_SECRET
  AUTH_GOOGLE_ID
  AUTH_GOOGLE_SECRET
  AUTH_RESEND_KEY
  RESEND_API_KEY
  AUTH_EMAIL_FROM
  DATABASE_URL
  SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SECRET_KEY
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME
  R2_PUBLIC_URL
  R2_ENDPOINT
)

# Vars that must differ between local and production (URLs)
declare -A OVERRIDES=(
  [AUTH_URL]="$PRODUCTION_URL"
  [NEXT_PUBLIC_APP_URL]="$PRODUCTION_URL"
  [NODE_ENV]="production"
)

push_var() {
  local key="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "⏭  $key (empty, skipping)"
    return
  fi
  echo "→ $key"
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf "%s" "$value" | vercel env add "$key" production >/dev/null
}

echo "Pushing env vars from .env.local → Vercel production…"
echo ""

for var in "${VARS[@]}"; do
  push_var "$var" "${!var:-}"
done

for key in "${!OVERRIDES[@]}"; do
  push_var "$key" "${OVERRIDES[$key]}"
done

echo ""
echo "✅ Done. Now run: vercel --prod"
