import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createOrg } from "../helpers/fixtures";
import { stripeMockFactory, resetMockStripe, mockStripeState } from "../helpers/mock-stripe";
import { twilioMockFactory, resetMockTwilio } from "../helpers/mock-twilio";
import {
  installFetchMock,
  uninstallFetchMock,
  registerFetchMock,
  resetFetchMock,
  jsonResponse,
} from "../helpers/mock-fetch";
import { invokeRoute } from "../helpers/api";

import { authMockFactory } from "../helpers/mock-auth";
vi.mock("@/lib/auth", () => authMockFactory());
vi.mock("@/lib/stripe", () => stripeMockFactory());
vi.mock("@/lib/twilio", () => twilioMockFactory());
vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

const stripeWebhook = await import("@/app/api/stripe/webhook/route");
const { getBalance } = await import("@/lib/billing/credits");

beforeAll(async () => {
  await getTestDb();
  installFetchMock();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
});

afterAll(async () => {
  await closeTestDb();
  uninstallFetchMock();
});

beforeEach(async () => {
  await resetTestDb();
  resetMockStripe();
  resetMockTwilio();
  resetFetchMock();
  // Default: OpenAI provisioning responds 200 so background provisioning after activation doesn't throw
  registerFetchMock("api.openai.com", (url) => {
    if (url.endsWith("/projects")) {
      return jsonResponse({ id: "proj_test_123" });
    }
    if (url.includes("/service_accounts")) {
      return jsonResponse({
        id: "svc_test_456",
        api_key: { value: "sk-proj-test-key" },
      });
    }
    return jsonResponse({}, { status: 404 });
  });
});

function queueEvent(event: unknown) {
  mockStripeState.constructedEvents.push(event);
}

describe("POST /api/stripe/webhook — signature", () => {
  it("rejects requests without stripe-signature header (400)", async () => {
    const { status, body } = await invokeRoute<{ error: string }>(stripeWebhook.POST, {
      method: "POST",
      body: { type: "ping" },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/missing signature/i);
  });

  it("rejects invalid signatures (400)", async () => {
    mockStripeState.signatureValid = false;
    const { status, body } = await invokeRoute<{ error: string }>(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=wrong" },
      body: { type: "ping" },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid signature/i);
  });

  it("accepts valid signatures (200)", async () => {
    queueEvent({ type: "ping", data: { object: {} } });
    const { status, body } = await invokeRoute<{ received: boolean }>(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=valid" },
      body: { type: "ping" },
    });
    expect(status).toBe(200);
    expect(body.received).toBe(true);
  });
});

describe("POST /api/stripe/webhook — checkout.session.completed (activation)", () => {
  it("credits org with $5 and activates", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "inactive" });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_activation_1",
          metadata: { orgId: org.id, type: "activation", amountCents: "500" },
        },
      },
    });

    const { status } = await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });
    expect(status).toBe(200);

    // balance credited
    expect(await getBalance(org.id)).toBe(500);
    // plan activated
    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [updated] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, org.id));
    expect(updated.planStatus).toBe("active");
  });

  it("stores stripeSessionId in transaction metadata (idempotency key)", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "inactive" });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_activation_2",
          metadata: { orgId: org.id, type: "activation", amountCents: "500" },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    const { creditTransactions } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [tx] = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.orgId, org.id));
    expect(tx.metadata).toMatchObject({ stripeSessionId: "cs_test_activation_2" });
  });

  it("skips when orgId missing from metadata", async () => {
    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_orphan",
          metadata: { type: "activation" },
        },
      },
    });
    const { status, body } = await invokeRoute<{ received: boolean }>(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });
    expect(status).toBe(200);
    expect(body.received).toBe(true);
  });
});

describe("POST /api/stripe/webhook — checkout.session.completed (credits)", () => {
  it("credits the specified pack amount", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_credits_1",
          metadata: { orgId: org.id, type: "credits", amountCents: "10000" },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });
    expect(await getBalance(org.id)).toBe(10000);
  });

  it("no-ops when amountCents is 0/missing", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_credits_zero",
          metadata: { orgId: org.id, type: "credits", amountCents: "0" },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });
    expect(await getBalance(org.id)).toBe(0);
  });
});

describe("POST /api/stripe/webhook — subscription lifecycle", () => {
  it("checkout.session.completed (subscription) → sets subscriptionId + pro plan", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active", plan: "starter" });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_sub_1",
          metadata: { orgId: org.id, type: "subscription" },
          subscription: "sub_test_xyz",
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [updated] = await db.select().from(organizations).where(eq(organizations.id, org.id));
    expect(updated.plan).toBe("pro");
    expect(updated.planStatus).toBe("pro");
    expect(updated.stripeSubscriptionId).toBe("sub_test_xyz");
  });

  it("customer.subscription.updated active → activates", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });

    queueEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test_abc",
          status: "active",
          metadata: { orgId: org.id },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [updated] = await db.select().from(organizations).where(eq(organizations.id, org.id));
    expect(updated.plan).toBe("pro");
  });

  it("customer.subscription.updated canceled → downgrades to starter/active", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "pro", plan: "pro" });

    queueEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test_cancel",
          status: "canceled",
          metadata: { orgId: org.id },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [updated] = await db.select().from(organizations).where(eq(organizations.id, org.id));
    expect(updated.plan).toBe("starter");
    expect(updated.planStatus).toBe("active");
  });

  it("customer.subscription.deleted → cancels", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "pro", plan: "pro" });

    queueEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_test_del",
          metadata: { orgId: org.id },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [updated] = await db.select().from(organizations).where(eq(organizations.id, org.id));
    expect(updated.plan).toBe("starter");
  });

  it("subscription event with missing orgId is a safe no-op", async () => {
    queueEvent({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_orphan", status: "active", metadata: {} } },
    });
    const { status } = await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });
    expect(status).toBe(200);
  });

  it("invoice.payment_failed is acknowledged but does not crash", async () => {
    queueEvent({
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test_1",
          subscription_details: { metadata: { orgId: "org-xyz" } },
        },
      },
    });
    const { status } = await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });
    expect(status).toBe(200);
  });

  it("unknown event types are acknowledged (no crash)", async () => {
    queueEvent({
      type: "customer.created",
      data: { object: { id: "cus_x" } },
    });
    const { status } = await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });
    expect(status).toBe(200);
  });
});

describe("POST /api/stripe/webhook — malformed payloads", () => {
  it("handles non-JSON body when signature is missing (still 400)", async () => {
    const { status } = await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      body: "not json",
    });
    expect(status).toBe(400);
  });
});
