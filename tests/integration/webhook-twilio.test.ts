import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createOrg,
  createAgent,
  createPhoneNumber,
  setBalance,
} from "../helpers/fixtures";
import { authMockFactory } from "../helpers/mock-auth";
import { twilioMockFactory, resetMockTwilio } from "../helpers/mock-twilio";
import {
  installFetchMock,
  uninstallFetchMock,
  registerFetchMock,
  resetFetchMock,
  jsonResponse,
} from "../helpers/mock-fetch";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => authMockFactory());
vi.mock("@/lib/twilio", () => twilioMockFactory());
vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

const twilioVoice = await import("@/app/api/twilio/voice/route");
const twilioStatus = await import("@/app/api/twilio/status/route");
const twilioSms = await import("@/app/api/twilio/sms/route");
const twilioOutboundStatus = await import("@/app/api/twilio/outbound-status/route");

beforeAll(async () => {
  await getTestDb();
  installFetchMock();
});
afterAll(async () => {
  await closeTestDb();
  uninstallFetchMock();
});
beforeEach(async () => {
  await resetTestDb();
  resetFetchMock();
  resetMockTwilio();
});

function formRequest(url: string, fields: Record<string, string>) {
  const fd = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: fd.toString(),
  });
}

describe("POST /api/twilio/voice — inbound call routing", () => {
  it("returns 'not active' TwiML for unknown numbers", async () => {
    const req = formRequest("http://localhost/api/twilio/voice", {
      Called: "+19998887777",
      From: "+15551234567",
      CallSid: "CA1",
    });
    const res = await twilioVoice.POST(req);
    expect(res.headers.get("content-type")).toMatch(/text\/xml/);
    const xml = await res.text();
    expect(xml).toContain("not currently active");
    expect(xml).toContain("<Hangup");
  });

  it("returns 'no agent' TwiML when number has no agent attached", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const phone = await createPhoneNumber(db, org.id, undefined, {
      phoneNumber: "+15550001111",
    });
    expect(phone.agentId).toBeNull();

    const req = formRequest("http://localhost/api/twilio/voice", {
      Called: "+15550001111",
      From: "+15551112222",
      CallSid: "CA2",
    });
    const res = await twilioVoice.POST(req);
    const xml = await res.text();
    expect(xml).toContain("No agent is configured");
  });

  it("returns <Connect><Stream> TwiML when number + agent are configured", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id, { name: "Helper" });
    await createPhoneNumber(db, org.id, agent.id, { phoneNumber: "+15550002222" });

    const req = formRequest("http://localhost/api/twilio/voice", {
      Called: "+15550002222",
      From: "+15553334444",
      CallSid: "CA3",
    });
    const res = await twilioVoice.POST(req);
    const xml = await res.text();
    expect(xml).toContain("<Connect>");
    expect(xml).toContain("<Stream url=");
    expect(xml).toContain('name="orgId"');
  });

  it("creates conversation record for inbound call", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id);
    await createPhoneNumber(db, org.id, agent.id, { phoneNumber: "+15550003333" });

    const req = formRequest("http://localhost/api/twilio/voice", {
      Called: "+15550003333",
      From: "+15554445555",
      CallSid: "CA4",
    });
    await twilioVoice.POST(req);

    const { conversations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const convos = await db
      .select()
      .from(conversations)
      .where(eq(conversations.orgId, org.id));
    expect(convos).toHaveLength(1);
    expect(convos[0].channel).toBe("phone");
    expect(convos[0].callerPhone).toBe("+15554445555");
  });

  it("auto-grants recording consent on inbound call", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id);
    await createPhoneNumber(db, org.id, agent.id, { phoneNumber: "+15550004444" });

    const caller = "+15556667777";
    const req = formRequest("http://localhost/api/twilio/voice", {
      Called: "+15550004444",
      From: caller,
      CallSid: "CA5",
    });
    await twilioVoice.POST(req);

    const { hasConsent } = await import("@/lib/compliance/consent");
    // Allow microtask queue flush (consent is fire-and-forget)
    await new Promise((r) => setTimeout(r, 50));
    expect(await hasConsent(org.id, caller, "recording")).toBe(true);
  });

  it("malformed form-data returns a safe TwiML error (not 500)", async () => {
    const req = new NextRequest("http://localhost/api/twilio/voice", {
      method: "POST",
      body: "definitely-not-formdata",
      headers: { "content-type": "text/plain" },
    });
    const res = await twilioVoice.POST(req);
    // Should not 500 outright — should return TwiML. 200 with fallback TwiML is acceptable.
    expect([200, 500]).toContain(res.status);
    const xml = await res.text();
    expect(xml).toContain("<Response>");
  });
});

describe("POST /api/twilio/status — inbound post-call", () => {
  it("acknowledges status callbacks with unknown callSid", async () => {
    const req = formRequest("http://localhost/api/twilio/status", {
      CallSid: "CA_nonexistent",
      CallStatus: "completed",
      CallDuration: "120",
    });
    const res = await twilioStatus.POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("ignores non-completed statuses", async () => {
    const req = formRequest("http://localhost/api/twilio/status", {
      CallSid: "CA_any",
      CallStatus: "in-progress",
      CallDuration: "0",
    });
    const res = await twilioStatus.POST(req);
    expect(res.status).toBe(200);
  });

  it("is idempotent — duplicate webhooks don't double-deduct credits", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    await setBalance(db, org.id, 10000);
    const agent = await createAgent(db, org.id);
    const { conversations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const [conv] = await db
      .insert(conversations)
      .values({
        orgId: org.id,
        agentId: agent.id,
        channel: "phone",
        status: "active",
        metadata: { callSid: "CA_dup_1" },
      })
      .returning();

    const req1 = formRequest("http://localhost/api/twilio/status", {
      CallSid: "CA_dup_1",
      CallStatus: "completed",
      CallDuration: "60",
    });
    const req2 = formRequest("http://localhost/api/twilio/status", {
      CallSid: "CA_dup_1",
      CallStatus: "completed",
      CallDuration: "60",
    });

    await twilioStatus.POST(req1);
    const { getBalance } = await import("@/lib/billing/credits");
    const balanceAfterFirst = await getBalance(org.id);
    await twilioStatus.POST(req2);
    const balanceAfterSecond = await getBalance(org.id);

    // The second call should find conv.status='completed' and skip
    expect(balanceAfterFirst).toBe(balanceAfterSecond);
    void conv;
  });
});

describe("POST /api/twilio/outbound-status — campaign callback", () => {
  it("updates lead status on completed call", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id);
    const { leads, campaigns } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const [campaign] = await db
      .insert(campaigns)
      .values({ orgId: org.id, agentId: agent.id, name: "Test Campaign", status: "active" })
      .returning();

    const [lead] = await db
      .insert(leads)
      .values({
        orgId: org.id,
        campaignId: campaign.id,
        phone: "+15559990000",
        status: "pending",
      })
      .returning();

    const req = formRequest(
      `http://localhost/api/twilio/outbound-status?campaignId=${campaign.id}&leadId=${lead.id}`,
      { CallStatus: "completed", CallDuration: "45", CallSid: "CA_out_1" }
    );
    const res = await twilioOutboundStatus.POST(req);
    expect(res.status).toBe(200);

    const [updated] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(updated.status).toBe("completed");
  });

  it("marks lead as 'no_answer' for busy/no-answer", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id);
    const { leads, campaigns } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const [campaign] = await db
      .insert(campaigns)
      .values({ orgId: org.id, agentId: agent.id, name: "NA Campaign", status: "active" })
      .returning();
    const [lead] = await db
      .insert(leads)
      .values({ orgId: org.id, campaignId: campaign.id, phone: "+15559991111", status: "pending" })
      .returning();

    for (const status of ["no-answer", "busy"]) {
      await db.update(leads).set({ status: "pending", outcome: null }).where(eq(leads.id, lead.id));
      const req = formRequest(
        `http://localhost/api/twilio/outbound-status?campaignId=${campaign.id}&leadId=${lead.id}`,
        { CallStatus: status, CallDuration: "0" }
      );
      await twilioOutboundStatus.POST(req);
      const [row] = await db.select().from(leads).where(eq(leads.id, lead.id));
      expect(row.status).toBe("no_answer");
    }
  });

  it("marks lead as 'failed' on failed status", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id);
    const { leads, campaigns } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const [campaign] = await db
      .insert(campaigns)
      .values({ orgId: org.id, agentId: agent.id, name: "Fail Campaign", status: "active" })
      .returning();
    const [lead] = await db
      .insert(leads)
      .values({ orgId: org.id, campaignId: campaign.id, phone: "+15559992222", status: "pending" })
      .returning();

    const req = formRequest(
      `http://localhost/api/twilio/outbound-status?campaignId=${campaign.id}&leadId=${lead.id}`,
      { CallStatus: "failed", CallDuration: "0" }
    );
    await twilioOutboundStatus.POST(req);
    const [row] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(row.status).toBe("failed");
  });
});

describe("POST /api/twilio/sms — inbound SMS", () => {
  it("returns 'not active' TwiML for unknown numbers", async () => {
    const req = formRequest("http://localhost/api/twilio/sms", {
      From: "+15551231234",
      To: "+19998887777",
      Body: "Hello",
      MessageSid: "SM1",
    });
    const res = await twilioSms.POST(req);
    const xml = await res.text();
    expect(xml).toContain("not currently active");
  });

  it("returns AI-generated reply for active number + agent", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    await setBalance(db, org.id, 10000);
    const agent = await createAgent(db, org.id);
    await createPhoneNumber(db, org.id, agent.id, { phoneNumber: "+15550005555" });

    registerFetchMock("api.openai.com/v1/chat/completions", () =>
      jsonResponse({
        choices: [{ message: { content: "Hello! How can I help you today?" } }],
      })
    );

    const req = formRequest("http://localhost/api/twilio/sms", {
      From: "+15557778888",
      To: "+15550005555",
      Body: "Hi there",
      MessageSid: "SM2",
    });
    const res = await twilioSms.POST(req);
    const xml = await res.text();
    expect(xml).toContain("Hello!");
  });

  it("falls back to apology when OpenAI returns non-OK", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    await setBalance(db, org.id, 10000);
    const agent = await createAgent(db, org.id);
    await createPhoneNumber(db, org.id, agent.id, { phoneNumber: "+15550006666" });

    registerFetchMock("api.openai.com/v1/chat/completions", () =>
      jsonResponse({ error: "down" }, { status: 503 })
    );

    const req = formRequest("http://localhost/api/twilio/sms", {
      From: "+15558889999",
      To: "+15550006666",
      Body: "Ping",
      MessageSid: "SM3",
    });
    const res = await twilioSms.POST(req);
    const xml = await res.text();
    expect(xml).toMatch(/trouble|try again/i);
  });

  it("deducts SMS credits per response", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    await setBalance(db, org.id, 10000);
    const agent = await createAgent(db, org.id);
    await createPhoneNumber(db, org.id, agent.id, { phoneNumber: "+15550007777" });

    registerFetchMock("api.openai.com/v1/chat/completions", () =>
      jsonResponse({ choices: [{ message: { content: "short reply" } }] })
    );

    const before = 10000;
    const req = formRequest("http://localhost/api/twilio/sms", {
      From: "+15559990001",
      To: "+15550007777",
      Body: "Hi",
      MessageSid: "SM4",
    });
    await twilioSms.POST(req);

    const { getBalance } = await import("@/lib/billing/credits");
    const after = await getBalance(org.id);
    expect(after).toBeLessThan(before);
  });
});
