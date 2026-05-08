/**
 * Thin wrapper around the Google Calendar v3 REST API.
 *
 * We deliberately use raw fetch instead of the `googleapis` SDK to keep the
 * dependency footprint small and match the style of `src/lib/calendar/calendly.ts`.
 *
 * Token management: this module doesn't persist tokens — callers pass an
 * access token (and optionally refresh it via `refreshAccessToken`) and write
 * results back into `calendar_integrations` themselves.
 */

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "openid",
  "email",
];

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope?: string;
  tokenType?: string;
  idToken?: string;
}

export interface GoogleUserInfo {
  email: string;
  email_verified?: boolean;
  name?: string;
  sub?: string;
}

export interface GoogleEvent {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled" | string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
  organizer?: { email?: string; displayName?: string };
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string; label?: string }>;
  };
}

export interface GoogleEventsListResponse {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleWatchChannel {
  id: string;
  resourceId: string;
  resourceUri?: string;
  expiration?: string;
}

export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const u = new URL(OAUTH_AUTH_URL);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", (params.scopes ?? GOOGLE_CALENDAR_SCOPES).join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", params.state);
  return u.toString();
}

export async function exchangeCodeForTokens(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope,
    tokenType: json.token_type,
    idToken: json.id_token,
  };
}

export async function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  return {
    accessToken: json.access_token,
    // Google does not return refresh_token on refresh; caller keeps the old one.
    refreshToken: null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope,
    tokenType: json.token_type,
  };
}

export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as GoogleUserInfo;
}

export interface ListEventsParams {
  calendarId?: string;
  syncToken?: string;
  pageToken?: string;
  updatedMin?: string; // ISO
  timeMin?: string; // ISO
  showDeleted?: boolean;
  maxResults?: number;
}

export class GoogleSyncTokenInvalid extends Error {
  constructor() {
    super("Google sync token invalid (410 Gone) — caller should perform a full re-sync");
  }
}

export async function listEvents(
  accessToken: string,
  params: ListEventsParams = {}
): Promise<GoogleEventsListResponse> {
  const calId = encodeURIComponent(params.calendarId || "primary");
  const u = new URL(`${CAL_BASE}/calendars/${calId}/events`);

  if (params.syncToken) u.searchParams.set("syncToken", params.syncToken);
  if (params.pageToken) u.searchParams.set("pageToken", params.pageToken);
  if (params.updatedMin) u.searchParams.set("updatedMin", params.updatedMin);
  if (params.timeMin) u.searchParams.set("timeMin", params.timeMin);
  if (params.showDeleted !== undefined) {
    u.searchParams.set("showDeleted", String(params.showDeleted));
  }
  u.searchParams.set("maxResults", String(params.maxResults ?? 250));
  u.searchParams.set("singleEvents", "true");

  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 410) throw new GoogleSyncTokenInvalid();
  if (!res.ok) {
    throw new Error(`Google events.list ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as GoogleEventsListResponse;
}

export async function watchEvents(
  accessToken: string,
  params: {
    calendarId?: string;
    channelId: string;
    address: string;
    token?: string;
    ttlSeconds?: number;
  }
): Promise<GoogleWatchChannel> {
  const calId = encodeURIComponent(params.calendarId || "primary");
  const body: Record<string, unknown> = {
    id: params.channelId,
    type: "web_hook",
    address: params.address,
  };
  if (params.token) body.token = params.token;
  if (params.ttlSeconds) body.params = { ttl: String(params.ttlSeconds) };

  const res = await fetch(`${CAL_BASE}/calendars/${calId}/events/watch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google events.watch ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    id: string;
    resourceId: string;
    resourceUri?: string;
    expiration?: string;
  };
  return {
    id: json.id,
    resourceId: json.resourceId,
    resourceUri: json.resourceUri,
    expiration: json.expiration,
  };
}

export async function stopChannel(
  accessToken: string,
  params: { channelId: string; resourceId: string }
): Promise<void> {
  const res = await fetch(`${CAL_BASE}/channels/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: params.channelId, resourceId: params.resourceId }),
  });
  // 204 on success; 404 if already gone — both acceptable.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google channels.stop ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
