import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createOrg, createUser, addMembership, setBalance } from "../helpers/fixtures";
import { setAuthUser, clearAuthUser, authMockFactory } from "../helpers/mock-auth";
import { stripeMockFactory, resetMockStripe, mockStripeState } from "../helpers/mock-stripe";
import { redisMockFactory, resetMockRedis } from "../helpers/mock-redis";
import { invokeRoute } from "../helpers/api";

vi.mock("@/lib/auth", () => authMockFactory());
vi.mock("@/lib/stripe", () => stripeMockFactory());
vi.mock("@/lib/redis", () => redisMockFactory());
vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

const balanceRoute = await import("@/app/api/billing/balance/route");
const creditsRoute = await import("@/app/api/billing/credits/route");
const checkoutRoute = await import("@/app/api/billing/checkout/route");
const activateRoute = await import("@/app/api/billing/activate/route");
const portalRoute = await import("@/app/api/billing/portal/route");
const { addCredits } = await import("@/lib/billing/credits");

beforeAll(async () => {
  await getTestDb();
});
afterAll(async () => {
  await closeTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  resetMockStripe();
  resetMockRedis();
  clearAuthUser();
});

async function authAsOrgOwner(planStatus = "active", plan = "starter") {
  const db = await getTestDb();
  const user = await createUser(db);
  const org = await createOrg(db, { planStatus, plan });
  await addMembership(db, user.id, org.id, "owner");
  setAuthUser({ id: user.id, email: user.email, name: user.name });
  return { user, org };
}

describe("GET /api/billing/balance", () => {
  it("requires auth", async () => {
    const { status } = await invokeRoute(balanceRoute.GET);
    expect(status).toBe(500);
  });

  it("returns 0 balance for a fresh org", async () => {
    await authAsOrgOwner();
    const { status, body } = await invokeRoute<{ balanceCents: number; transactions: unknown[] }>(
      balanceRoute.GET
    );
    expect(status).toBe(200);
    expect(body.balanceCents).toBe(0);
    expect(body.transactions).toEqual([]);
  });

  it("returns balance + history for the authed org", async () => {
    const { org } = await authAsOrgOwner();
    await addCredits(org.id, 500, "Activation deposit", "purchase");
    await addCredits(org.id, 2500, "Credit pack", "purchase");
    const { status, body } = await invokeRoute<{
      balanceCents: number;
      plan: string;
      planStatus: string;
      transactions: { amountCents: number }[];
    }>(balanceRoute.GET);
    expect(status).toBe(200);
    expect(body.balanceCents).toBe(3000);
    expect(body.plan).toBe("starter");
    expect(body.planStatus).toBe("active");
    expect(body.transactions).toHaveLength(2);
  });

  it("does not leak another org's balance", async () => {
    const db = await getTestDb();
    const { org: orgA } = await authAsOrgOwner();
    const otherUser = await createUser(db);
    const orgB = await createOrg(db);
    await addMembership(db, otherUser.id, orgB.id, "owner");
    await setBalance(db, orgB.id, 99_999);
    await setBalance(db, orgA.id, 100);

    const { body } = await invokeRoute<{ balanceCents: number }>(balanceRoute.GET);
    expect(body.balanceCents).toBe(100);
  });
});

describe("POST /api/billing/credits — checkout", () => {
  it("requires auth", async () => {
    const { status } = await invokeRoute(creditsRoute.POST, {
      method: "POST",
      body: { amountCents: 2500 },
    });
    expect(status).toBe(500);
  });

  it("rejects non-pack amounts (no custom top-ups)", async () => {
    await authAsOrgOwner();
    const { status, body } = await invokeRoute<{ error: string }>(creditsRoute.POST, {
      method: "POST",
      body: { amountCents: 100 },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid credit amount/i);
  });

  it("accepts each valid credit pack", async () => {
    const validAmounts = [2500, 5000, 10000, 25000];
    for (const amt of validAmounts) {
      await authAsOrgOwner();
      const { status, body } = await invokeRoute<{ url: string }>(creditsRoute.POST, {
        method: "POST",
        body: { amountCents: amt },
      });
      expect(status).toBe(200);
      expect(body.url).toMatch(/checkout\.stripe\.com/);
      // Reset between iterations
      await resetTestDb();
      resetMockStripe();
      clearAuthUser();
    }
  });

  it("creates a Stripe customer if the org lacks one", async () => {
    await authAsOrgOwner();
    await invokeRoute(creditsRoute.POST, {
      method: "POST",
      body: { amountCents: 2500 },
    });
    const opCalls = mockStripeState.calls.map((c) => c.op);
    expect(opCalls).toContain("customers.create");
    expect(opCalls).toContain("checkout.sessions.create");
  });

  it("reuses existing Stripe customer", async () => {
    const db = await getTestDb();
    const { org } = await authAsOrgOwner();
    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(organizations).set({ stripeCustomerId: "cus_existing_123" }).where(eq(organizations.id, org.id));

    await invokeRoute(creditsRoute.POST, {
      method: "POST",
      body: { amountCents: 5000 },
    });
    const opCalls = mockStripeState.calls.map((c) => c.op);
    expect(opCalls).not.toContain("customers.create");
    expect(opCalls).toContain("checkout.sessions.create");
  });
});

describe("POST /api/billing/checkout — subscription upgrade", () => {
  it("requires auth", async () => {
    const { status } = await invokeRoute(checkoutRoute.POST, { method: "POST" });
    expect(status).toBe(500);
  });

  it("creates a subscription checkout", async () => {
    await authAsOrgOwner();
    const { status, body } = await invokeRoute<{ url: string }>(checkoutRoute.POST, {
      method: "POST",
    });
    expect(status).toBe(200);
    expect(body.url).toMatch(/checkout\.stripe\.com/);
    const createCall = mockStripeState.calls.find((c) => c.op === "checkout.sessions.create");
    expect(createCall).toBeDefined();
    const args = createCall!.args[0] as { mode: string };
    expect(args.mode).toBe("subscription");
  });
});

describe("POST /api/billing/activate", () => {
  it("requires auth", async () => {
    const { status } = await invokeRoute(activateRoute.POST, { method: "POST" });
    expect(status).toBe(500);
  });

  it("rejects already-activated orgs", async () => {
    await authAsOrgOwner("active");
    const { status, body } = await invokeRoute<{ error: string }>(activateRoute.POST, {
      method: "POST",
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/already activated/i);
  });

  it("creates $5 + 3-day Pro trial checkout (subscription) for inactive orgs", async () => {
    await authAsOrgOwner("inactive");
    const { status, body } = await invokeRoute<{ url: string }>(activateRoute.POST, {
      method: "POST",
    });
    expect(status).toBe(200);
    expect(body.url).toMatch(/checkout\.stripe.com/);
    const createCall = mockStripeState.calls.find((c) => c.op === "checkout.sessions.create");
    const args = createCall!.args[0] as {
      mode: string;
      line_items: Array<{ price_data: { unit_amount: number } }>;
      metadata: Record<string, string>;
      subscription_data: { trial_period_days: number; metadata: Record<string, string> };
    };
    expect(args.mode).toBe("subscription");
    expect(args.line_items).toHaveLength(2);
    expect(args.line_items[0].price_data.unit_amount).toBe(19900);
    expect(args.line_items[1].price_data.unit_amount).toBe(500);
    expect(args.metadata.type).toBe("activation_trial");
    expect(args.subscription_data.trial_period_days).toBe(3);
  });

  it("rate-limits billing endpoint to 5 req/min", async () => {
    await authAsOrgOwner("inactive");
    for (let i = 0; i < 5; i++) {
      await invokeRoute(activateRoute.POST, { method: "POST" });
    }
    const { status } = await invokeRoute(activateRoute.POST, { method: "POST" });
    expect(status).toBe(429);
  });
});

describe("POST /api/billing/portal", () => {
  it("requires auth", async () => {
    const { status } = await invokeRoute(portalRoute.POST, { method: "POST" });
    expect(status).toBe(500);
  });

  it("rejects when no stripeCustomerId set", async () => {
    await authAsOrgOwner();
    const { status, body } = await invokeRoute<{ error: string }>(portalRoute.POST, {
      method: "POST",
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/no billing account/i);
  });

  it("creates a portal session when org has a stripe customer", async () => {
    const { org } = await authAsOrgOwner();
    const db = await getTestDb();
    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(organizations)
      .set({ stripeCustomerId: "cus_portal_test" })
      .where(eq(organizations.id, org.id));

    const { status, body } = await invokeRoute<{ url: string }>(portalRoute.POST, {
      method: "POST",
    });
    expect(status).toBe(200);
    expect(body.url).toMatch(/billing\.stripe\.com/);
  });
});
