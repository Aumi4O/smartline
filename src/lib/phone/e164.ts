/**
 * Best-effort E.164 for US/CA numbers. Used so Twilio, OpenAI SIP, and
 * our DB (phoneNumbers, consent) can match even if formatting differs.
 */
export function toE164BestEffort(phone: string | undefined | null): string {
  if (!phone) return "";
  const trimmed = String(phone).trim();
  if (!trimmed) return "";
  const d = trimmed.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) {
    if (d.length === 12 && d.startsWith("+1")) return d;
    return d;
  }
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length > 0) return d.startsWith("+") ? d : `+${d}`;
  return "";
}
