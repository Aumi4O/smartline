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
 * Reads a SIP header value case-insensitively.
 *
 * OpenAI's `realtime.call.incoming` webhook delivers headers as an
 * ARRAY of `{ name, value }` pairs (see `data.sip_headers` in the
 * event payload). Earlier drafts / some environments use an OBJECT
 * keyed by header name. Support both so we don't have to re-test
 * the agent every time OpenAI tweaks the shape.
 *
 *   [{"name":"From","value":"<sip:+123@twilio.com>"}]   // array form
 *   { "From": "<sip:+123@twilio.com>" }                 // object form
 */
export function readSipHeader(
  headers:
    | Array<{ name?: string; value?: string }>
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();

  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (typeof h?.name === "string" && h.name.toLowerCase() === target) {
        return typeof h.value === "string" ? h.value : undefined;
      }
    }
    return undefined;
  }

  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      if (Array.isArray(v)) return v[0];
      return v;
    }
  }
  return undefined;
}

/**
 * Extracts the user-part of a SIP URI (the part before `@`).
 * For SmartLine's purposes this returns either a phone number (+E.164)
 * or an OpenAI project id (proj_...), depending on where the URI
 * points.
 *
 *   "<sip:proj_abc@sip.api.openai.com>;transport=tls" → "proj_abc"
 *   "<sip:+12184966788@sip.twilio.com>;tag=xyz"      → "+12184966788"
 *   "\"+972508120708\" <sip:+972508120708@twilio>..."  → "+972508120708"
 */
export function extractSipUriUser(headerValue: string | undefined | null): string {
  if (!headerValue) return "";
  const s = String(headerValue);
  // Match a SIP URI inside angle brackets first (name-addr form), then
  // fall back to a bare URI anywhere in the string.
  const m = s.match(/<sip:([^@>;?]+)@/i) || s.match(/sip:([^@>;?]+)@/i);
  return m ? m[1].trim() : "";
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
