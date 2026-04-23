import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createOrg,
  createAgent,
  createPhoneNumber,
} from "../helpers/fixtures";
import { authMockFactory } from "../helpers/mock-auth";
import { twilioMockFactory } from "../helpers/mock-twilio";
import {
  installFetchMock,
  uninstallFetchMock,
  registerFetchMock,
  resetFetchMock,
  jsonResponse,
} from "../helpers/mock-fetch";
import { invokeRoute } from "../helpers/api";

vi.mock("@/lib/auth", () => authMockFactory());
vi.mock("@/lib/twilio", () => twilioMockFactory());
vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

const sipRoute = await import("@/app/api/openai/sip-webhook/route");
const toolRoute = await import("@/app/api/openai/tool-execute/route");

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
  // Default accept endpoint returns 200
  registerFetchMock(/\/v1\/realtime\/calls\/.+\/accept/, () =>
    jsonResponse({ ok: true })
  );
});

describe("POST /api/openai/sip-webhook — event type", () => {
  it("ignores non-realtime.call.incoming events", async () => {
    const { status, body } = await invokeRoute<{ ok: boolean }>(sipRoute.POST, {
      method: "POST",
      body: { type: "session.created" },
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("rejects payloads missing call_id or project_id (400)", async () => {
    const { status } = await invokeRoute(sipRoute.POST, {
      method: "POST",
      body: {
        type: "realtime.call.incoming",
        call: { headers: { from: "sip:+15551112222@sip.example.com" } },
      },
    });
    expect(status).toBe(400);
  });
});

describe("POST /api/openai/sip-webhook — project mapping", () => {
  it("returns 404 for unknown project_id", async () => {
    const { status, body } = await invokeRoute<{ error: string }>(sipRoute.POST, {
      method: "POST",
      body: {
        type: "realtime.call.incoming",
        call: {
          id: "call_1",
          project_id: "proj_unknown",
          headers: {
            from: "sip:+15551112222@sip.example.com",
            to: "sip:+15550001111@smartline.com",
          },
        },
      },
    });
    expect(status).toBe(404);
    expect(body.error).toMatch(/unknown project/i);
  });

  it("returns 404 when org has no active agent", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, {
      openaiProjectId: "proj_noagent",
      planStatus: "active",
    });
    const { status, body } = await invokeRoute<{ error: string }>(sipRoute.POST, {
      method: "POST",
      body: {
        type: "realtime.call.incoming",
        call: {
          id: "call_2",
          project_id: org.openaiProjectId,
          headers: {
            from: "sip:+15551112222@sip.example.com",
            to: "sip:+15550001111@smartline.com",
          },
        },
      },
    });
    expect(status).toBe(404);
    expect(body.error).toMatch(/no agent/i);
  });
});

describe("POST /api/openai/sip-webhook — happy path", () => {
  it("accepts call, creates conversation, returns accepted:true", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, {
      openaiProjectId: "proj_happy",
      planStatus: "active",
      openaiApiKeyEncrypted: "sk-proj-test",
    });
    const agent = await createAgent(db, org.id, { name: "Router" });
    await createPhoneNumber(db, org.id, agent.id, { phoneNumber: "+15550002222" });

    const acceptCalls: string[] = [];
    registerFetchMock(/\/v1\/realtime\/calls\/.+\/accept/, (url) => {
      acceptCalls.push(url);
      return jsonResponse({ ok: true });
    });

    const { status, body } = await invokeRoute<{
      accepted: boolean;
      callId: string;
      conversationId: string;
      agentName: string;
    }>(sipRoute.POST, {
      method: "POST",
      body: {
        type: "realtime.call.incoming",
        call: {
          id: "call_happy_xyz",
          project_id: "proj_happy",
          headers: {
            from: "sip:+15551112222@sip.example.com",
            to: "sip:+15550002222@smartline.com",
          },
        },
      },
    });

    expect(status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.callId).toBe("call_happy_xyz");
    expect(body.agentName).toBe("Router");
    expect(acceptCalls).toHaveLength(1);
    expect(acceptCalls[0]).toContain("/v1/realtime/calls/call_happy_xyz/accept");

    const { conversations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(conversations).where(eq(conversations.orgId, org.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe("phone");
  });

  it("falls back to first active agent when dialed number has no agent", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, {
      openaiProjectId: "proj_fallback",
      planStatus: "active",
    });
    const agent = await createAgent(db, org.id, { name: "Default" });

    const { status, body } = await invokeRoute<{ agentName: string; accepted: boolean }>(
      sipRoute.POST,
      {
        method: "POST",
        body: {
          type: "realtime.call.incoming",
          call: {
            id: "call_fallback",
            project_id: "proj_fallback",
            headers: {
              from: "sip:+15551112222@sip.example.com",
              to: "sip:+19998887777@smartline.com",
            },
          },
        },
      }
    );
    expect(status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.agentName).toBe(agent.name);
  });

  it("returns 500 when OpenAI accept endpoint returns error", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, {
      openaiProjectId: "proj_badaccept",
      planStatus: "active",
    });
    await createAgent(db, org.id);

    resetFetchMock();
    registerFetchMock(/\/v1\/realtime\/calls\/.+\/accept/, () =>
      jsonResponse({ error: "backend broken" }, { status: 502 })
    );

    const { status, body } = await invokeRoute<{ error: string }>(sipRoute.POST, {
      method: "POST",
      body: {
        type: "realtime.call.incoming",
        call: {
          id: "call_bad",
          project_id: "proj_badaccept",
          headers: {
            from: "sip:+15551112222@sip.example.com",
            to: "sip:+15550001111@smartline.com",
          },
        },
      },
    });
    expect(status).toBe(500);
    expect(body.error).toMatch(/failed to accept/i);
  });

  it("uses env OPENAI_API_KEY when org lacks encrypted key", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, {
      openaiProjectId: "proj_envkey",
      planStatus: "active",
      openaiApiKeyEncrypted: undefined,
    });
    await createAgent(db, org.id);

    let sentAuth: string | null = null;
    registerFetchMock(/\/v1\/realtime\/calls\/.+\/accept/, (_url, init) => {
      sentAuth = (init?.headers as Record<string, string>)?.["Authorization"] ?? null;
      return jsonResponse({ ok: true });
    });

    await invokeRoute(sipRoute.POST, {
      method: "POST",
      body: {
        type: "realtime.call.incoming",
        call: {
          id: "call_envkey",
          project_id: "proj_envkey",
          headers: {
            from: "sip:+15551112222@sip.example.com",
            to: "sip:+15550001111@smartline.com",
          },
        },
      },
    });

    expect(sentAuth).toBeTruthy();
    expect(sentAuth).toMatch(/^Bearer /);
    expect(org.id).toBeTruthy();
  });

  it("does not leak to other orgs — project_id scoping", async () => {
    const db = await getTestDb();
    const orgA = await createOrg(db, {
      openaiProjectId: "proj_A",
      planStatus: "active",
    });
    const agentA = await createAgent(db, orgA.id, { name: "A-Agent" });
    const orgB = await createOrg(db, {
      openaiProjectId: "proj_B",
      planStatus: "active",
    });
    await createAgent(db, orgB.id, { name: "B-Agent" });

    const { body } = await invokeRoute<{ agentName: string }>(sipRoute.POST, {
      method: "POST",
      body: {
        type: "realtime.call.incoming",
        call: {
          id: "call_iso",
          project_id: "proj_A",
          headers: {
            from: "sip:+15551112222@sip.example.com",
            to: "sip:+15550001111@smartline.com",
          },
        },
      },
    });
    expect(body.agentName).toBe(agentA.name);
    expect(body.agentName).not.toBe("B-Agent");
  });
});

describe("POST /api/openai/tool-execute", () => {
  it("rejects payloads without tool_name (400)", async () => {
    const { status, body } = await invokeRoute<{ error: string }>(toolRoute.POST, {
      method: "POST",
      body: { call_id: "call_1" },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/missing tool_name/i);
  });

  it("returns 'unknown tool' for unsupported tool names", async () => {
    const { status, body } = await invokeRoute<{ result: { error: string } }>(toolRoute.POST, {
      method: "POST",
      body: { tool_name: "hack_system", call_id: "call_x" },
    });
    expect(status).toBe(200);
    expect(body.result.error).toMatch(/unknown tool/i);
  });

  it("lookup_knowledge returns fallback when no agentId", async () => {
    const { status, body } = await invokeRoute<{ result: { answer: string } }>(toolRoute.POST, {
      method: "POST",
      body: { tool_name: "lookup_knowledge", arguments: { query: "hours" }, call_id: "call_nope" },
    });
    expect(status).toBe(200);
    expect(body.result.answer).toMatch(/don't have access/i);
  });

  it("transfer_call returns no_transfer when no transferPhone configured", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id);
    const { conversations } = await import("@/lib/db/schema");
    await db.insert(conversations).values({
      orgId: org.id,
      agentId: agent.id,
      channel: "phone",
      metadata: { sipCallId: "call_no_xfer" },
    });

    const { status, body } = await invokeRoute<{ result: { action: string } }>(toolRoute.POST, {
      method: "POST",
      body: { tool_name: "transfer_call", arguments: {}, call_id: "call_no_xfer" },
    });
    expect(status).toBe(200);
    expect(body.result.action).toBe("no_transfer");
  });

  it("transfer_call returns transfer directive when transferPhone configured", async () => {
    const db = await getTestDb();
    const org = await createOrg(db, { planStatus: "active" });
    const agent = await createAgent(db, org.id);
    const { agents, conversations } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(agents)
      .set({ transferPhone: "+15559998888" })
      .where(eq(agents.id, agent.id));
    await db.insert(conversations).values({
      orgId: org.id,
      agentId: agent.id,
      channel: "phone",
      metadata: { sipCallId: "call_xfer_ok" },
    });

    const { status, body } = await invokeRoute<{ result: { action: string; transferTo: string } }>(
      toolRoute.POST,
      {
        method: "POST",
        body: { tool_name: "transfer_call", arguments: { reason: "Complex issue" }, call_id: "call_xfer_ok" },
      }
    );
    expect(status).toBe(200);
    expect(body.result.action).toBe("transfer");
    expect(body.result.transferTo).toBe("+15559998888");
  });
});
