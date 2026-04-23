import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export async function logAuditEvent(
  orgId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  userId?: string,
  ipAddress?: string,
  metadata?: Record<string, unknown>
) {
  await db.insert(auditLogs).values({
    orgId,
    userId,
    action,
    resourceType,
    resourceId,
    ipAddress,
    metadata: metadata || {},
  });
}
