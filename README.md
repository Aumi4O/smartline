This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Calendar integrations (Calendly + Google Calendar)

SmartLine can sync bookings from Calendly and Google Calendar into the
Appointments dashboard, and the realtime voice agent can text callers a
Calendly link via a `share_booking_link` tool.

Required env vars (see `.env.example`):

- `SECRETS_ENCRYPTION_KEY` — 64 hex chars, used to encrypt OAuth tokens and
  the Calendly PAT/webhook signing key at rest.
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` — OAuth client from
  the Google Cloud Console with the redirect URI set to
  `${NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`.
- `GOOGLE_OAUTH_REDIRECT_URI` — optional override of the redirect URI.

After configuring env vars, apply the new database migration
(`drizzle/0001_calendar_bookings.sql`), then visit **Dashboard → Integrations**
and connect Calendly (paste a Personal Access Token) and/or Google Calendar
(OAuth). Bookings flow into **Dashboard → Appointments** via:

- Calendly webhooks (`/api/webhooks/calendly`, HMAC-verified)
- Google Calendar push notifications (`/api/webhooks/google-calendar`,
  incremental `events.list` with persisted sync token)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
