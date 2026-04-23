import { beforeAll, afterAll, vi } from "vitest";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://pglite@localhost/test";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_dummy";
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "ACdummytestsid00000000000000000000";
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "dummy_twilio_token";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-dummy";
process.env.OPENAI_ADMIN_KEY = process.env.OPENAI_ADMIN_KEY || "sk-admin-test-dummy";
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "http://localhost:0";
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "dummy_redis_token";
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret-at-least-32-chars-long";
process.env.AUTH_GOOGLE_ID = process.env.AUTH_GOOGLE_ID || "test-google-id";
process.env.AUTH_GOOGLE_SECRET = process.env.AUTH_GOOGLE_SECRET || "test-google-secret";
process.env.AUTH_RESEND_KEY = process.env.AUTH_RESEND_KEY || "re_test_dummy";

beforeAll(() => {
  vi.stubGlobal("console", {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
