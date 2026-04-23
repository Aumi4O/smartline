import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createOrg, createUser } from "../helpers/fixtures";

vi.mock("@/lib/db", async () => {
  const testDb = await getTestDb();
  return { db: testDb };
});

const { logAuditEvent } = await import("@/lib/compliance/audit");

beforeAll(async () => {
  await getTestDb();
});
afterAll(async () => {
  await closeTestDb();
});
beforeEach(async () => {
  await resetTestDb();
});

describe("logAuditEvent", () => {
  it("writes a basic audit row", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const { auditLogs } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await logAuditEvent(org.id, "agent.create", "agent", undefined, undefined, undefined, {
      name: "Test Agent",
    });

    const rows = await db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, org.id),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("agent.create");
    expect(rows[0].resourceType).toBe("agent");
    expect(rows[0].metadata).toMatchObject({ name: "Test Agent" });
  });

  it("records user and ip when provided", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const user = await createUser(db);
    const { auditLogs } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await logAuditEvent(
      org.id,
      "login",
      "session",
      undefined,
      user.id,
      "192.168.1.1",
      {}
    );

    const [row] = await db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, org.id),
    });
    expect(row.userId).toBe(user.id);
    expect(row.ipAddress).toBe("192.168.1.1");
  });

  it("handles missing metadata (defaults to {})", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const { auditLogs } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await logAuditEvent(org.id, "x", "y");
    const [row] = await db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, org.id),
    });
    expect(row.metadata).toEqual({});
  });

  it("is scoped per org", async () => {
    const db = await getTestDb();
    const orgA = await createOrg(db);
    const orgB = await createOrg(db);
    const { auditLogs } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await logAuditEvent(orgA.id, "a", "x");
    await logAuditEvent(orgB.id, "b", "y");

    const aRows = await db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, orgA.id),
    });
    const bRows = await db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, orgB.id),
    });
    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(1);
    expect(aRows[0].action).toBe("a");
    expect(bRows[0].action).toBe("b");
  });

  it("supports many concurrent writes", async () => {
    const db = await getTestDb();
    const org = await createOrg(db);
    const { auditLogs } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const writes = Array.from({ length: 10 }, (_, i) =>
      logAuditEvent(org.id, `action-${i}`, "test", undefined, undefined, undefined, {
        index: i,
      })
    );
    await Promise.all(writes);
    const rows = await db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, org.id),
    });
    expect(rows).toHaveLength(10);
  });
});
