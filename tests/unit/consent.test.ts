import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createOrg } from "../helpers/fixtures";

vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

const { hasConsent, grantConsent, revokeConsent, getRecordingDisclosure } = await import(
  "@/lib/compliance/consent"
);

beforeAll(async () => {
  await getTestDb();
});
afterAll(async () => {
  await closeTestDb();
});
beforeEach(async () => {
  await resetTestDb();
});

describe("getRecordingDisclosure", () => {
  it("returns a non-empty disclosure string", () => {
    const s = getRecordingDisclosure();
    expect(s.length).toBeGreaterThan(20);
  });

  it("mentions recording and consent", () => {
    const s = getRecordingDisclosure().toLowerCase();
    expect(s).toMatch(/recorded|recording/);
    expect(s).toMatch(/consent/);
  });
});

describe("grantConsent / hasConsent", () => {
  it("defaults to no consent", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    expect(await hasConsent(org.id, "+15551234567", "recording")).toBe(false);
    expect(await hasConsent(org.id, "+15551234567", "marketing")).toBe(false);
    expect(await hasConsent(org.id, "+15551234567", "sms")).toBe(false);
  });

  it("grants consent and makes hasConsent return true", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await grantConsent(org.id, "+15551234567", "recording", "ivr_keypress");
    expect(await hasConsent(org.id, "+15551234567", "recording")).toBe(true);
  });

  it("separates consent types (recording vs marketing)", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await grantConsent(org.id, "+15551234567", "recording", "ivr");
    expect(await hasConsent(org.id, "+15551234567", "recording")).toBe(true);
    expect(await hasConsent(org.id, "+15551234567", "marketing")).toBe(false);
  });

  it("scopes consent per phone number", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await grantConsent(org.id, "+15551111111", "recording", "web");
    expect(await hasConsent(org.id, "+15551111111", "recording")).toBe(true);
    expect(await hasConsent(org.id, "+15552222222", "recording")).toBe(false);
  });

  it("scopes consent per org (cross-tenant isolation)", async () => {
    const db = await getTestDb();
    const orgA = await createOrg(db);
    const orgB = await createOrg(db);
    await grantConsent(orgA.id, "+15551234567", "recording", "web");
    expect(await hasConsent(orgA.id, "+15551234567", "recording")).toBe(true);
    expect(await hasConsent(orgB.id, "+15551234567", "recording")).toBe(false);
  });

  it("grantConsent is idempotent (doesn't create duplicate rows)", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const { consentRecords } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await grantConsent(org.id, "+15551234567", "recording", "ivr");
    await grantConsent(org.id, "+15551234567", "recording", "web");
    await grantConsent(org.id, "+15551234567", "recording", "sms");

    const rows = await db.query.consentRecords.findMany({
      where: eq(consentRecords.orgId, org.id),
    });
    expect(rows).toHaveLength(1);
  });
});

describe("revokeConsent", () => {
  it("revokes active consent so hasConsent returns false", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await grantConsent(org.id, "+15551234567", "marketing", "web_form");
    expect(await hasConsent(org.id, "+15551234567", "marketing")).toBe(true);

    await revokeConsent(org.id, "+15551234567", "marketing");
    expect(await hasConsent(org.id, "+15551234567", "marketing")).toBe(false);
  });

  it("revoking is a no-op when no consent exists", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await expect(
      revokeConsent(org.id, "+15551234567", "sms")
    ).resolves.not.toThrow();
  });

  it("re-granting after revocation restores consent", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await grantConsent(org.id, "+15551234567", "sms", "web");
    await revokeConsent(org.id, "+15551234567", "sms");
    expect(await hasConsent(org.id, "+15551234567", "sms")).toBe(false);
    await grantConsent(org.id, "+15551234567", "sms", "web");
    expect(await hasConsent(org.id, "+15551234567", "sms")).toBe(true);
  });

  it("revocation preserves audit trail (row still exists with revokedAt)", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const { consentRecords } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await grantConsent(org.id, "+15551234567", "recording", "ivr");
    await revokeConsent(org.id, "+15551234567", "recording");
    const rows = await db.query.consentRecords.findMany({
      where: eq(consentRecords.orgId, org.id),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).not.toBeNull();
    expect(rows[0].grantedAt).not.toBeNull();
  });
});
