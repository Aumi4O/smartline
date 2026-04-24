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

# ------------------------------------------------------------------
# Load .env.local by parsing each line manually. This works on macOS
# Bash 3.2 and handles values containing spaces, '<', '>', '=' etc.
# ------------------------------------------------------------------
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    \#*|'') continue ;;
    *=*)    ;;
    *) continue ;;
  esac
  key="${line%%=*}"
  value="${line#*=}"
  key=$(echo "$key" | tr -d '[:space:]')
  [ -z "$key" ] && continue
  export "$key=$value"
done < .env.local

# Production URL overrides (must differ from local .env.local values)
PRODUCTION_URL="https://smartlineagent.com"

# All env vars to push (values come from .env.local)
VARS="
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
"

push_var() {
  key="$1"
  value="$2"
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

for var in $VARS; do
  value=$(eval "printf '%s' \"\$$var\"")
  push_var "$var" "$value"
done

push_var "AUTH_URL" "$PRODUCTION_URL"
push_var "NEXT_PUBLIC_APP_URL" "$PRODUCTION_URL"
push_var "NODE_ENV" "production"

echo ""
echo "✅ Done. Now run: vercel --prod"
