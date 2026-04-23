import { db } from "@/lib/db";
import { webhookEndpoints } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export async function fireWebhook(
  orgId: string,
  event: string,
  data: Record<string, unknown>
) {
  const endpoints = await db.query.webhookEndpoints.findMany({
    where: and(
      eq(webhookEndpoints.orgId, orgId),
      eq(webhookEndpoints.isActive, true)
    ),
  });

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);

  for (const endpoint of endpoints) {
    const events = (endpoint.events as string[]) || [];
    if (!events.includes(event) && !events.includes("*")) continue;

    const signature = crypto
      .createHmac("sha256", endpoint.secret)
      .update(body)
      .digest("hex");

    try {
      await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SmartLine-Signature": signature,
          "X-SmartLine-Event": event,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.warn(`Webhook delivery failed for ${endpoint.url}:`, error);
    }
  }
}

export async function createWebhookEndpoint(
  orgId: string,
  url: string,
  events: string[] = ["call.completed"]
) {
  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

  const [endpoint] = await db
    .insert(webhookEndpoints)
    .values({ orgId, url, events, secret, isActive: true })
    .returning();

  return endpoint;
}

export async function listWebhookEndpoints(orgId: string) {
  return db.query.webhookEndpoints.findMany({
    where: eq(webhookEndpoints.orgId, orgId),
  });
}

export async function deleteWebhookEndpoint(endpointId: string, orgId: string) {
  await db
    .delete(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, endpointId),
        eq(webhookEndpoints.orgId, orgId)
      )
    );
}
