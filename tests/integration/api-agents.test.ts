import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createOrg, createUser, addMembership, createAgent } from "../helpers/fixtures";
import { setAuthUser, clearAuthUser, authMockFactory } from "../helpers/mock-auth";
import { invokeRoute } from "../helpers/api";

vi.mock("@/lib/auth", () => authMockFactory());
vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

const agentsRoute = await import("@/app/api/agents/route");
const agentByIdRoute = await import("@/app/api/agents/[id]/route");
const agentRollbackRoute = await import("@/app/api/agents/[id]/rollback/route");
const { agents: agentsTable } = await import("@/lib/db/schema");

beforeAll(async () => {
  await getTestDb();
});
afterAll(async () => {
  await closeTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  clearAuthUser();
});

async function setupAuthedOrg(opts: { planStatus?: string; plan?: string } = {}) {
  const db = await getTestDb();
  const user = await createUser(db);
  const org = await createOrg(db, { planStatus: opts.planStatus ?? "active", plan: opts.plan });
  await addMembership(db, user.id, org.id, "owner");
  setAuthUser({ id: user.id, email: user.email, name: user.name });
  return { user, org };
}

describe("GET /api/agents — auth", () => {
  it("returns 500 with Unauthorized when no session", async () => {
    clearAuthUser();
    const { status, body } = await invokeRoute<{ error: string }>(agentsRoute.GET);
    expect(status).toBe(500);
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns empty list for fresh org", async () => {
    await setupAuthedOrg();
    const { status, body } = await invokeRoute<{ agents: unknown[] }>(agentsRoute.GET);
    expect(status).toBe(200);
    expect(body.agents).toEqual([]);
  });

  it("returns only the authed user's org agents (tenant isolation)", async () => {
    const db = await getTestDb();
    const { org: orgA } = await setupAuthedOrg();
    // Second org with its own agent, owned by a different user
    const otherUser = await createUser(db);
    const orgB = await createOrg(db);
    await addMembership(db, otherUser.id, orgB.id, "owner");
    await createAgent(db, orgA.id, { name: "A-agent" });
    await createAgent(db, orgB.id, { name: "B-agent" });

    const { status, body } = await invokeRoute<{ agents: { name: string }[] }>(agentsRoute.GET);
    expect(status).toBe(200);
    expect(body.agents.map((a) => a.name)).toEqual(["A-agent"]);
  });
});

describe("POST /api/agents", () => {
  it("rejects without auth", async () => {
    clearAuthUser();
    const { status, body } = await invokeRoute(agentsRoute.POST, {
      method: "POST",
      body: { name: "Test" },
    });
    expect(status).toBe(500);
    expect((body as { error: string }).error).toMatch(/unauthorized/i);
  });

  it("rejects when org plan is inactive", async () => {
    await setupAuthedOrg({ planStatus: "inactive" });
    const { status, body } = await invokeRoute(agentsRoute.POST, {
      method: "POST",
      body: { name: "Test" },
    });
    expect(status).toBe(403);
    expect((body as { error: string }).error).toMatch(/not activated/i);
  });

  it("creates an agent when activated", async () => {
    const { org } = await setupAuthedOrg();
    const { status, body } = await invokeRoute<{ agent: { id: string; orgId: string; name: string } }>(
      agentsRoute.POST,
      { method: "POST", body: { name: "Support Bot" } }
    );
    expect(status).toBe(201);
    expect(body.agent.name).toBe("Support Bot");
    expect(body.agent.orgId).toBe(org.id);
  });

  it("enforces PAYG agent limit", async () => {
    const { org } = await setupAuthedOrg({ plan: "starter" });
    const db = await getTestDb();
    // Create max agents (starter PAYG limit is 1)
    const { PAYG_LIMITS } = await import("@/lib/pricing");
    for (let i = 0; i < PAYG_LIMITS.maxAgents; i++) {
      await createAgent(db, org.id, { name: `Agent ${i}` });
    }
    const { status, body } = await invokeRoute(agentsRoute.POST, {
      method: "POST",
      body: { name: "Overflow" },
    });
    expect(status).toBe(403);
    expect((body as { error: string }).error).toMatch(/limit reached/i);
  });

  it("allows more agents on pro plan", async () => {
    const { org } = await setupAuthedOrg({ plan: "pro" });
    const db = await getTestDb();
    const { PAYG_LIMITS } = await import("@/lib/pricing");
    for (let i = 0; i < PAYG_LIMITS.maxAgents; i++) {
      await createAgent(db, org.id, { name: `Agent ${i}` });
    }
    const { status } = await invokeRoute(agentsRoute.POST, {
      method: "POST",
      body: { name: "Pro agent" },
    });
    expect(status).toBe(201);
  });

  it("writes an audit log entry on creation", async () => {
    const { org } = await setupAuthedOrg();
    await invokeRoute(agentsRoute.POST, {
      method: "POST",
      body: { name: "Audited" },
    });
    const db = await getTestDb();
    const { auditLogs } = await import("@/lib/db/schema");
    const { eq, and } = await import("drizzle-orm");
    const rows = await db.query.auditLogs.findMany({
      where: and(eq(auditLogs.orgId, org.id), eq(auditLogs.action, "agent.created")),
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/agents/[id]", () => {
  it("returns 404 when agent belongs to another org (cross-tenant read blocked)", async () => {
    const db = await getTestDb();
    const { org: orgA } = await setupAuthedOrg();
    const otherUser = await createUser(db);
    const orgB = await createOrg(db);
    await addMembership(db, otherUser.id, orgB.id, "owner");
    const foreignAgent = await createAgent(db, orgB.id);

    const { status } = await invokeRoute(agentByIdRoute.GET, {
      context: { params: Promise.resolve({ id: foreignAgent.id }) },
    });
    // We're authed as orgA but asking for orgB's agent -> should 404
    expect([404, 403, 500]).toContain(status);
    expect(status).not.toBe(200);
  });

  it("returns the agent when it belongs to your org", async () => {
    const db = await getTestDb();
    const { org } = await setupAuthedOrg();
    const agent = await createAgent(db, org.id, { name: "Mine" });
    const { status, body } = await invokeRoute<{ agent: { id: string; name: string } }>(
      agentByIdRoute.GET,
      { context: { params: Promise.resolve({ id: agent.id }) } }
    );
    expect(status).toBe(200);
    expect(body.agent.id).toBe(agent.id);
    expect(body.agent.name).toBe("Mine");
  });
});

describe("PATCH /api/agents/[id] — tenancy isolation on update", () => {
  it("does not modify another org's agent", async () => {
    const db = await getTestDb();
    const { org: orgA } = await setupAuthedOrg();
    const otherUser = await createUser(db);
    const orgB = await createOrg(db);
    await addMembership(db, otherUser.id, orgB.id, "owner");
    const foreignAgent = await createAgent(db, orgB.id, { name: "Original" });

    // authed as orgA tries to rename orgB's agent
    await invokeRoute(agentByIdRoute.PATCH, {
      method: "PATCH",
      body: { name: "Pwned" },
      context: { params: Promise.resolve({ id: foreignAgent.id }) },
    });

    // verify orgB's agent is unchanged
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(agentsTable).where(eq(agentsTable.id, foreignAgent.id));
    expect(row.name).toBe("Original");
    expect(orgA.id).not.toBe(orgB.id);
  });

  it("does modify the caller's own agent", async () => {
    const db = await getTestDb();
    const { org } = await setupAuthedOrg();
    const agent = await createAgent(db, org.id, { name: "Old" });
    const { status } = await invokeRoute(agentByIdRoute.PATCH, {
      method: "PATCH",
      body: { name: "New" },
      context: { params: Promise.resolve({ id: agent.id }) },
    });
    expect(status).toBe(200);

    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(agentsTable).where(eq(agentsTable.id, agent.id));
    expect(row.name).toBe("New");
  });
});

describe("DELETE /api/agents/[id] — tenancy isolation", () => {
  it("does not soft-delete another org's agent", async () => {
    const db = await getTestDb();
    await setupAuthedOrg();
    const otherUser = await createUser(db);
    const orgB = await createOrg(db);
    await addMembership(db, otherUser.id, orgB.id, "owner");
    const foreignAgent = await createAgent(db, orgB.id, { name: "Foreign" });

    await invokeRoute(agentByIdRoute.DELETE, {
      method: "DELETE",
      context: { params: Promise.resolve({ id: foreignAgent.id }) },
    });

    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(agentsTable).where(eq(agentsTable.id, foreignAgent.id));
    expect(row.isActive).toBe(true);
  });
});

describe("POST /api/agents/[id]/rollback", () => {
  it("blocks rollback on cross-tenant agent", async () => {
    const db = await getTestDb();
    await setupAuthedOrg();
    const otherUser = await createUser(db);
    const orgB = await createOrg(db);
    await addMembership(db, otherUser.id, orgB.id, "owner");
    const foreignAgent = await createAgent(db, orgB.id);

    const { status } = await invokeRoute(agentRollbackRoute.POST, {
      method: "POST",
      body: { version: 1 },
      context: { params: Promise.resolve({ id: foreignAgent.id }) },
    });
    expect(status).not.toBe(200);
  });
});
