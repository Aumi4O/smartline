/**
 * OpenAI SIP Connector helpers.
 *
 * We hand PSTN calls from Twilio to OpenAI via `<Dial><Sip>...</Sip></Dial>`.
 * OpenAI fires `realtime.call.incoming` to /api/openai/sip-webhook, which accepts
 * the call and configures the agent (model, voice, instructions, tools).
 */

/**
 * OpenAI Realtime SIP Connector hostname.
 *
 * Must be `sip.api.openai.com` (NOT `sip.openai.com`, which does not
 * resolve and causes Twilio to return SIP 476 / error 32011
 * "Unresolvable destination").
 *
 * Reference: https://developers.openai.com/api/docs/guides/realtime-sip
 * "Point your SIP trunk at the OpenAI SIP endpoint, using the project ID
 *  for which you configured the webhook, e.g.,
 *  `sip:$PROJECT_ID@sip.api.openai.com;transport=tls`."
 */
export const OPENAI_SIP_HOST = "sip.api.openai.com";

/**
 * Builds a SIP URI to OpenAI SIP Connector with optional custom SIP headers.
 * Twilio's `<Sip>` supports URI-parameter-style custom headers prefixed with `X-`;
 * OpenAI echoes these into the `realtime.call.incoming` webhook payload under
 * `call.headers`.
 *
 * Example:
 *   buildSipUri("proj_123", { "X-SmartLine-AgentId": "abc" })
 *   → "sip:proj_123@sip.openai.com;transport=tls?X-SmartLine-AgentId=abc"
 */
export function buildSipUri(
  openaiProjectId: string,
  headers: Record<string, string> = {}
): string {
  const base = `sip:${openaiProjectId}@${OPENAI_SIP_HOST};transport=tls`;
  const keys = Object.keys(headers).filter(
    (k) => headers[k] != null && headers[k] !== ""
  );
  if (keys.length === 0) return base;
  const qs = keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(headers[k])}`)
    .join("&");
  return `${base}?${qs}`;
}

/**
 * Reads a `call.headers` value case-insensitively. OpenAI sends headers back
 * as an object keyed by the SIP header name; casing can vary.
 */
export function readSipHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      if (Array.isArray(v)) return v[0];
      return v;
    }
  }
  return undefined;
}

/**
 * Escape a string for safe inclusion in TwiML XML.
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
