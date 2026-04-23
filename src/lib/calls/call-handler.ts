import { db } from "@/lib/db";
import { conversations, messages, agents, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { searchKnowledge } from "@/lib/knowledge/knowledge-service";
import { getBusinessProfile, buildSystemPrompt } from "@/lib/knowledge/business-profile";
import type { BusinessProfileInput } from "@/lib/knowledge/business-profile";

export async function getAgentForCall(orgId: string, agentId?: string) {
  if (agentId) {
    return db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.orgId, orgId), eq(agents.isActive, true)),
    });
  }

  return db.query.agents.findFirst({
    where: and(eq(agents.orgId, orgId), eq(agents.isActive, true)),
  });
}

export async function buildCallConfig(orgId: string, agentId: string, callerPhone?: string) {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) throw new Error("Agent not found");

  let systemPrompt = agent.systemPrompt || "";

  if (!systemPrompt) {
    const profile = await getBusinessProfile(orgId);
    if (profile) {
      systemPrompt = buildSystemPrompt(profile as BusinessProfileInput);
    }
  }

  const knowledgeContext = await searchKnowledge(agentId, "general business information");
  if (knowledgeContext.length > 0) {
    systemPrompt += "\n\nKNOWLEDGE BASE:\n" + knowledgeContext.join("\n---\n");
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    systemPrompt,
    greeting: agent.greeting || "Hello! How can I help you today?",
    voice: agent.voice || "shimmer",
    model: agent.voiceModel || "gpt-realtime",
    language: agent.language || "en",
    transferPhone: agent.transferPhone,
    tools: buildToolDefinitions(agentId),
  };
}

function buildToolDefinitions(agentId: string) {
  return [
    {
      type: "function" as const,
      name: "lookup_knowledge",
      description: "Search the business knowledge base for information about services, pricing, hours, FAQ, policies, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for" },
        },
        required: ["query"],
      },
    },
    {
      type: "function" as const,
      name: "transfer_call",
      description: "Transfer the call to a human. Use when the caller explicitly asks to speak to a person, or when you cannot help them.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the call is being transferred" },
        },
        required: ["reason"],
      },
    },
  ];
}

export async function createCallRecord(
  orgId: string,
  agentId: string,
  channel: "phone" | "web" | "sms",
  callerPhone?: string,
  metadata?: Record<string, unknown>
) {
  const [conversation] = await db
    .insert(conversations)
    .values({
      orgId,
      agentId,
      channel,
      callerPhone,
      status: "active",
      metadata: metadata || {},
    })
    .returning();

  return conversation;
}

export async function endCallRecord(
  conversationId: string,
  summary?: string,
  durationSec?: number,
  costCents?: number
) {
  await db
    .update(conversations)
    .set({
      status: "completed",
      summary,
      durationSec,
      costCents,
      endedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));
}

export async function addCallMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string
) {
  await db.insert(messages).values({
    conversationId,
    role,
    content,
  });
}

export async function getCallHistory(orgId: string, limit = 50) {
  return db.query.conversations.findMany({
    where: eq(conversations.orgId, orgId),
    orderBy: (c, { desc }) => [desc(c.startedAt)],
    limit,
    with: { agent: true },
  });
}

export async function getCallDetail(conversationId: string, orgId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)),
    with: { agent: true, messages: true },
  });

  return conversation;
}
