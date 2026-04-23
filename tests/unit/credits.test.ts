import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createOrg } from "../helpers/fixtures";

vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

// Dynamic imports AFTER the mock so the module picks up pglite
const { addCredits, deductCredits, getBalance, getTransactionHistory, getAutoTopupSettings, updateAutoTopup } =
  await import("@/lib/billing/credits");

beforeAll(async () => {
  await getTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetTestDb();
});

describe("getBalance", () => {
  it("returns 0 for org with no balance row", async () => {
    const db = await getTestDb();
    // Create org without using fixtures (so no balance row is inserted)
    const { organizations } = await import("@/lib/db/schema");
    const [org] = await db
      .insert(organizations)
      .values({ name: "Lonely", slug: `lonely-${Date.now()}` })
      .returning();
    const balance = await getBalance(org.id);
    expect(balance).toBe(0);
  });

  it("returns the current balance_cents", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 1000, "test");
    expect(await getBalance(org.id)).toBe(1000);
  });
});

describe("addCredits", () => {
  it("adds credits and returns new balance", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const bal = await addCredits(org.id, 500, "Activation deposit", "purchase");
    expect(bal).toBe(500);
    expect(await getBalance(org.id)).toBe(500);
  });

  it("is additive across multiple calls", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 500, "first");
    await addCredits(org.id, 1000, "second");
    await addCredits(org.id, 250, "third");
    expect(await getBalance(org.id)).toBe(1750);
  });

  it("writes a transaction row for each credit", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 500, "first", "purchase", { ref: "abc" });
    await addCredits(org.id, 100, "bonus credit", "bonus");
    const history = await getTransactionHistory(org.id);
    expect(history).toHaveLength(2);
    expect(history[0].type).toBe("bonus");
    expect(history[0].amountCents).toBe(100);
    expect(history[0].balanceAfter).toBe(600);
    expect(history[1].amountCents).toBe(500);
    expect(history[1].balanceAfter).toBe(500);
  });

  it("stores metadata with transaction", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 2500, "Purchase", "purchase", {
      stripeSessionId: "cs_test_123",
    });
    const [tx] = await getTransactionHistory(org.id);
    expect(tx.metadata).toMatchObject({ stripeSessionId: "cs_test_123" });
  });

  it("supports refund type", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 500, "refund for failed call", "refund");
    const [tx] = await getTransactionHistory(org.id);
    expect(tx.type).toBe("refund");
  });
});

describe("deductCredits", () => {
  it("deducts when balance is sufficient", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 1000, "seed");

    const result = await deductCredits(org.id, 300, "phone call");
    expect(result.success).toBe(true);
    expect(result.balance).toBe(700);
    expect(await getBalance(org.id)).toBe(700);
  });

  it("rejects when balance is insufficient", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 100, "seed");

    const result = await deductCredits(org.id, 500, "too expensive");
    expect(result.success).toBe(false);
    expect(result.balance).toBe(100);
    expect(await getBalance(org.id)).toBe(100);
  });

  it("never allows balance to go negative (GREATEST protection)", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 100, "seed");
    // Try to deduct more than available — should be rejected
    const result = await deductCredits(org.id, 500, "should fail");
    expect(result.success).toBe(false);
    expect(await getBalance(org.id)).toBe(100);
    // Balance never goes below 0
    expect(await getBalance(org.id)).toBeGreaterThanOrEqual(0);
  });

  it("writes transaction with negative amount", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 1000, "seed");
    await deductCredits(org.id, 250, "phone call", "usage");
    const [latest] = await getTransactionHistory(org.id);
    expect(latest.amountCents).toBe(-250);
    expect(latest.balanceAfter).toBe(750);
    expect(latest.type).toBe("usage");
  });

  it("supports phone_number and extra_agent deduction types", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 10000, "seed");
    await deductCredits(org.id, 180, "Phone number monthly", "phone_number");
    await deductCredits(org.id, 4900, "Extra agent", "extra_agent");
    const history = await getTransactionHistory(org.id);
    const types = history.map((h) => h.type);
    expect(types).toContain("phone_number");
    expect(types).toContain("extra_agent");
  });

  it("reject-then-approve: after topup, deduct succeeds", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 100, "seed");
    expect((await deductCredits(org.id, 500, "nope")).success).toBe(false);
    await addCredits(org.id, 500, "topup");
    expect((await deductCredits(org.id, 500, "now")).success).toBe(true);
    expect(await getBalance(org.id)).toBe(100);
  });

  it("exactly-zero-balance edge case", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 100, "seed");
    const r = await deductCredits(org.id, 100, "exact");
    expect(r.success).toBe(true);
    expect(r.balance).toBe(0);
    // Next deduct of any amount fails
    expect((await deductCredits(org.id, 1, "nope")).success).toBe(false);
  });
});

describe("auto-topup settings", () => {
  it("returns defaults for new orgs", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const s = await getAutoTopupSettings(org.id);
    expect(s.autoTopup).toBe(false);
    expect(s.topupAmount).toBe(2500);
    expect(s.topupThreshold).toBe(500);
  });

  it("updates and persists settings", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await updateAutoTopup(org.id, true, 5000, 1000);
    const s = await getAutoTopupSettings(org.id);
    expect(s.autoTopup).toBe(true);
    expect(s.topupAmount).toBe(5000);
    expect(s.topupThreshold).toBe(1000);
  });

  it("can disable auto-topup without changing amounts", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await updateAutoTopup(org.id, true, 5000, 1000);
    await updateAutoTopup(org.id, false);
    const s = await getAutoTopupSettings(org.id);
    expect(s.autoTopup).toBe(false);
    // amounts preserved
    expect(s.topupAmount).toBe(5000);
    expect(s.topupThreshold).toBe(1000);
  });
});

describe("transaction history", () => {
  it("returns most recent first", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    await addCredits(org.id, 100, "one");
    await addCredits(org.id, 200, "two");
    await addCredits(org.id, 300, "three");
    const history = await getTransactionHistory(org.id);
    expect(history[0].description).toBe("three");
    expect(history[2].description).toBe("one");
  });

  it("respects the limit parameter", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    for (let i = 0; i < 5; i++) await addCredits(org.id, 100, `t${i}`);
    const history = await getTransactionHistory(org.id, 3);
    expect(history).toHaveLength(3);
  });

  it("is scoped per org", async () => {
    const db = await getTestDb();
    const orgA = await createOrg(db);
    const orgB = await createOrg(db);
    await addCredits(orgA.id, 100, "a");
    await addCredits(orgB.id, 999, "b");
    const histA = await getTransactionHistory(orgA.id);
    const histB = await getTransactionHistory(orgB.id);
    expect(histA).toHaveLength(1);
    expect(histB).toHaveLength(1);
    expect(histA[0].description).toBe("a");
    expect(histB[0].description).toBe("b");
  });
});
