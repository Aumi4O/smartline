import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for at-rest secrets (OAuth tokens,
 * Calendly PATs, webhook signing keys).
 *
 * Format (base64): version(1) || iv(12) || authTag(16) || ciphertext.
 *
 * The key comes from `SECRETS_ENCRYPTION_KEY` (preferred: 64 hex chars =
 * 32 bytes). To make local/dev setup painless, if the env var is missing
 * or the wrong length we deterministically derive a 32-byte key from
 * `NEXTAUTH_SECRET` via SHA-256. That fallback is acceptable for dev only;
 * production deployments must set `SECRETS_ENCRYPTION_KEY` explicitly.
 */

const ALG = "aes-256-gcm";
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, "hex");
    return cachedKey;
  }

  const fallbackSource =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "smartline-dev-fallback-secret-do-not-use-in-prod";
  cachedKey = createHash("sha256").update(fallbackSource).digest();
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptSecret: plaintext must be a non-empty string");
  }
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 1 + IV_LEN + TAG_LEN + 1) {
    throw new Error("decryptSecret: payload too short");
  }
  if (buf[0] !== VERSION) {
    throw new Error(`decryptSecret: unsupported version ${buf[0]}`);
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = buf.subarray(1 + IV_LEN + TAG_LEN);

  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Convenience: handle nullable ciphertext columns. */
export function decryptSecretMaybe(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}
