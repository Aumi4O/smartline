/**
 * Thin wrapper around the Calendly v2 REST API.
 *
 * Auth: Personal Access Token (PAT) supplied by the org owner. Tokens are
 * stored AES-GCM encrypted in `calendar_integrations.access_token_ciphertext`.
 *
 * Docs: https://developer.calendly.com/api-docs
 */

const BASE_URL = "https://api.calendly.com";

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  current_organization: string;
}

export interface CalendlyWebhookSubscription {
  uri: string;
  callback_url: string;
  events: string[];
  state: string;
  signing_key: string;
  scope: string;
}

async function calendlyFetch(
  pat: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
}

export async function getCalendlyMe(pat: string): Promise<CalendlyUser> {
  const res = await calendlyFetch(pat, "/users/me");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Calendly /users/me ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.resource as CalendlyUser;
}

export async function createCalendlyWebhook(
  pat: string,
  params: {
    userUri: string;
    organizationUri: string;
    callbackUrl: string;
    events?: string[];
  }
): Promise<CalendlyWebhookSubscription> {
  const body = {
    url: params.callbackUrl,
    events: params.events ?? ["invitee.created", "invitee.canceled"],
    organization: params.organizationUri,
    user: params.userUri,
    scope: "user",
  };

  const res = await calendlyFetch(pat, "/webhook_subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Calendly POST /webhook_subscriptions ${res.status}: ${text.slice(0, 200)}`
    );
  }
  const json = await res.json();
  return json.resource as CalendlyWebhookSubscription;
}

export async function deleteCalendlyWebhook(
  pat: string,
  subscriptionUri: string
): Promise<void> {
  // Calendly returns the subscription URI like
  // https://api.calendly.com/webhook_subscriptions/<uuid>; we DELETE the same URL.
  const res = await fetch(subscriptionUri, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Calendly DELETE webhook ${res.status}: ${text.slice(0, 200)}`);
  }
}
