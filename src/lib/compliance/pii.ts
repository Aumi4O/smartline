/**
 * Regex-based PII detector/redactor used to populate messages.content_redacted.
 * Intentionally conservative — over-redaction is preferred to leakage.
 *
 * For high-stakes production use, pair with an LLM-based detector on the full
 * transcript for fields this regex pass can miss (names, addresses, etc.).
 */

const PATTERNS = {
  ssn: /\b(?!000|666|9\d{2})\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g,
  creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  phoneUS: /(?:\+?1[-. ]?)?\(?[2-9]\d{2}\)?[-. ]?\d{3}[-. ]?\d{4}(?!\d)/g,
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g,
  dob: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g,
  usAddress: /\b\d+\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court)\b/gi,
} as const;

export type PIIType = keyof typeof PATTERNS;

export interface PIIDetection {
  type: PIIType;
  value: string;
  start: number;
  end: number;
}

export function detectPII(text: string): PIIDetection[] {
  if (!text) return [];
  const results: PIIDetection[] = [];

  for (const [type, pattern] of Object.entries(PATTERNS) as [PIIType, RegExp][]) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (type === "creditCard") {
        const digits = match[0].replace(/\D/g, "");
        if (digits.length < 13 || digits.length > 19) continue;
        if (!luhnValid(digits)) continue;
      }
      results.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return results.sort((a, b) => a.start - b.start);
}

export function redactPII(text: string): string {
  if (!text) return text;
  const detections = detectPII(text);
  if (detections.length === 0) return text;

  const merged: PIIDetection[] = [];
  for (const d of detections) {
    const last = merged[merged.length - 1];
    if (last && d.start < last.end) {
      last.end = Math.max(last.end, d.end);
    } else {
      merged.push({ ...d });
    }
  }

  let out = "";
  let cursor = 0;
  for (const d of merged) {
    out += text.slice(cursor, d.start);
    out += `[REDACTED:${d.type.toUpperCase()}]`;
    cursor = d.end;
  }
  out += text.slice(cursor);
  return out;
}

export function hasPII(text: string): boolean {
  return detectPII(text).length > 0;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
