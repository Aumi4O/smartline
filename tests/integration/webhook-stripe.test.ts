import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import { addMembership, createOrg, createUser } from "../helpers/fixtures";
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
  registerFetchMock("api.mailgun.net", () => jsonResponse({ id: "email_test_123" }));
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
  it("credits org with $15 and activates", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "inactive" });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_activation_1",
          metadata: { orgId: org.id, type: "activation_trial", amountCents: "1500" },
          subscription: "sub_test_trialing_1",
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
    expect(await getBalance(org.id)).toBe(1500);
    // plan activated
    const { organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [updated] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, org.id));
    expect(updated.planStatus).toBe("pro");
    expect(updated.stripeSubscriptionId).toBe("sub_test_trialing_1");
  });

  it("stores stripeSessionId in transaction metadata (idempotency key)", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "inactive" });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_activation_2",
          metadata: { orgId: org.id, type: "activation_trial", amountCents: "1500" },
          subscription: "sub_test_trialing_2",
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

  it("emails the checkout email when trial activation completes", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "inactive" });
    const emails: unknown[] = [];

    registerFetchMock("api.mailgun.net", (_url, init) => {
      emails.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
      return jsonResponse({ id: "email_test_activation" });
    });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_activation_email",
          customer_details: { email: "Buyer@Test.Local" },
          metadata: {
            orgId: org.id,
            type: "activation_trial",
            amountCents: "400",
            tier: "starter",
          },
          subscription: "sub_test_trialing_email",
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: "buyer@test.local",
      subject: "Your SmartLine trial is active",
    });
    expect(emails[0]).toMatchObject({
      text: expect.stringContaining("Starter is $49.00/mo"),
    });
    expect(emails[0]).toMatchObject({
      text: expect.stringContaining("$4.00 in usage credits"),
    });
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

  it("emails the org owner when credits are purchased", async () => {
    const db = await getTestDb();
    const user = await createUser(db, { email: "owner@test.local" });
    const org = await createOrg(db, { planStatus: "active" });
    await addMembership(db, user.id, org.id, "owner");
    const emails: unknown[] = [];

    registerFetchMock("api.mailgun.net", (_url, init) => {
      emails.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
      return jsonResponse({ id: "email_test_credits" });
    });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_credits_email",
          metadata: { orgId: org.id, type: "credits", amountCents: "10000" },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: "owner@test.local",
      subject: "SmartLine credits added",
    });
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
          metadata: { orgId: org.id, type: "subscription", tier: "scale" },
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
    expect(updated.plan).toBe("scale");
    expect(updated.planStatus).toBe("pro");
    expect(updated.stripeSubscriptionId).toBe("sub_test_xyz");
  });

  it("checkout.session.completed (subscription) emails the checkout email", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active", plan: "starter" });
    const emails: unknown[] = [];

    registerFetchMock("api.mailgun.net", (_url, init) => {
      emails.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
      return jsonResponse({ id: "email_test_subscription" });
    });

    queueEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_sub_email",
          customer_details: { email: "ScaleBuyer@Test.Local" },
          metadata: { orgId: org.id, type: "subscription", tier: "scale" },
          subscription: "sub_test_scale_email",
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: "scalebuyer@test.local",
      subject: "Your SmartLine plan is active",
      text: expect.stringContaining("Scale is $299.00/mo"),
    });
  });

  it("customer.subscription.updated past_due → still Pro (dunning)", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "pro", plan: "pro" });

    queueEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test_pastdue",
          status: "past_due",
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
    expect(updated.plan).toBe("growth");
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
    expect(updated.plan).toBe("growth");
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
    expect(updated.stripeSubscriptionId).toBeNull();
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
    expect(updated.stripeSubscriptionId).toBeNull();
  });

  it("customer.subscription.deleted emails the org owner", async () => {
    const db = await getTestDb();
    const user = await createUser(db, { email: "cancel-owner@test.local" });
    const org = await createOrg(db, { planStatus: "pro", plan: "scale" });
    await addMembership(db, user.id, org.id, "owner");
    const emails: unknown[] = [];

    registerFetchMock("api.mailgun.net", (_url, init) => {
      emails.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
      return jsonResponse({ id: "email_test_cancel" });
    });

    queueEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_test_del_email",
          metadata: { orgId: org.id },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: "cancel-owner@test.local",
      subject: "SmartLine plan was cancelled",
    });
  });

  it("customer.subscription.trial_will_end emails the org owner", async () => {
    const db = await getTestDb();
    const user = await createUser(db, { email: "trial-owner@test.local" });
    const org = await createOrg(db, { planStatus: "pro", plan: "pro" });
    await addMembership(db, user.id, org.id, "owner");
    const emails: unknown[] = [];

    registerFetchMock("api.mailgun.net", (_url, init) => {
      emails.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
      return jsonResponse({ id: "email_test_trial_end" });
    });

    queueEvent({
      type: "customer.subscription.trial_will_end",
      data: {
        object: {
          id: "sub_test_trial_ending",
          metadata: { orgId: org.id },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: "trial-owner@test.local",
      subject: "Your SmartLine plan trial ends soon",
    });
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

  it("invoice.payment_failed emails the org owner", async () => {
    const db = await getTestDb();
    const user = await createUser(db, { email: "billing-owner@test.local" });
    const org = await createOrg(db, { planStatus: "pro", plan: "growth" });
    await addMembership(db, user.id, org.id, "owner");
    const emails: unknown[] = [];

    registerFetchMock("api.mailgun.net", (_url, init) => {
      emails.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
      return jsonResponse({ id: "email_test_payment_failed" });
    });

    queueEvent({
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test_1",
          subscription_details: { metadata: { orgId: org.id } },
        },
      },
    });
    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: "billing-owner@test.local",
      subject: "SmartLine payment failed",
    });
  });

  it("invoice.payment_failed with invalid org id is acknowledged but does not crash", async () => {
    queueEvent({
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test_invalid_org",
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

describe("POST /api/stripe/webhook — unpaid customer capture", () => {
  it("customer.created creates an inactive Supabase user/org for guest Stripe customers", async () => {
    const db = await getTestDb();

    queueEvent({
      type: "customer.created",
      data: {
        object: {
          id: "cus_test_guest_lead",
          email: "Lead@Test.Local",
          metadata: {},
          deleted: false,
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    const { users, orgMemberships, organizations, creditBalances } = await import(
      "@/lib/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, "lead@test.local"));
    expect(user).toBeTruthy();

    const [membership] = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.userId, user.id));
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, membership.orgId));
    const [balance] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.orgId, org.id));

    expect(org).toMatchObject({
      plan: "starter",
      planStatus: "inactive",
      stripeCustomerId: "cus_test_guest_lead",
    });
    expect(balance.balanceCents).toBe(0);
  });

  it("customer.created with org metadata attaches the Stripe customer to the existing org", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "inactive" });

    queueEvent({
      type: "customer.created",
      data: {
        object: {
          id: "cus_test_existing_org",
          email: "existing@test.local",
          metadata: { orgId: org.id },
          deleted: false,
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
    const [updated] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, org.id));

    expect(updated.stripeCustomerId).toBe("cus_test_existing_org");
    expect(updated.planStatus).toBe("inactive");
  });

  it("checkout.session.expired captures an unpaid guest checkout as inactive", async () => {
    const db = await getTestDb();
    mockStripeState.customers.set("cus_test_expired_guest", {
      id: "cus_test_expired_guest",
      email: "expired@test.local",
      metadata: {},
    });

    queueEvent({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_test_expired_guest",
          customer: "cus_test_expired_guest",
          customer_details: null,
          customer_email: null,
          metadata: { type: "guest_activation_trial", tier: "starter" },
        },
      },
    });

    await invokeRoute(stripeWebhook.POST, {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: {},
    });

    const { users, orgMemberships, organizations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, "expired@test.local"));
    const [membership] = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.userId, user.id));
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, membership.orgId));

    expect(org).toMatchObject({
      plan: "starter",
      planStatus: "inactive",
      stripeCustomerId: "cus_test_expired_guest",
    });
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
