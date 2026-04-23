import { db } from "@/lib/db";
import { agents, agentVersions, phoneNumbers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const VOICE_OPTIONS = [
  { id: "alloy", name: "Alloy", style: "Neutral" },
  { id: "ash", name: "Ash", style: "Warm" },
  { id: "ballad", name: "Ballad", style: "Smooth" },
  { id: "coral", name: "Coral", style: "Clear" },
  { id: "echo", name: "Echo", style: "Deep" },
  { id: "fable", name: "Fable", style: "Storytelling" },
  { id: "nova", name: "Nova", style: "Energetic" },
  { id: "onyx", name: "Onyx", style: "Rich" },
  { id: "shimmer", name: "Shimmer", style: "Bright" },
  { id: "sage", name: "Sage", style: "Calm" },
] as const;

export const LANGUAGE_OPTIONS = [
  { id: "en", name: "English" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "pt", name: "Portuguese" },
  { id: "it", name: "Italian" },
  { id: "nl", name: "Dutch" },
  { id: "ja", name: "Japanese" },
  { id: "zh", name: "Chinese" },
  { id: "ar", name: "Arabic" },
  { id: "he", name: "Hebrew" },
  { id: "ru", name: "Russian" },
] as const;

export interface AgentInput {
  name: string;
  systemPrompt?: string;
  greeting?: string;
  voice?: string;
  model?: string;
  language?: string;
  channels?: string[];
  transferPhone?: string;
}

export async function createAgent(orgId: string, userId: string, input: AgentInput) {
  const [agent] = await db
    .insert(agents)
    .values({
      orgId,
      name: input.name,
      systemPrompt: input.systemPrompt || "",
      greeting: input.greeting || "Hello! How can I help you today?",
      voice: input.voice || "shimmer",
      model: input.model || "gpt-5-mini",
      language: input.language || "en",
      channels: input.channels || ["web"],
      transferPhone: input.transferPhone,
      version: 1,
    })
    .returning();

  await db.insert(agentVersions).values({
    agentId: agent.id,
    version: 1,
    systemPrompt: agent.systemPrompt,
    greeting: agent.greeting,
    voice: agent.voice,
    model: agent.model,
    toolConfig: [],
    changeNote: "Initial version",
    createdBy: userId,
  });

  return agent;
}

export async function updateAgent(
  agentId: string,
  orgId: string,
  userId: string,
  input: Partial<AgentInput>
) {
  const existing = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.orgId, orgId)),
  });

  if (!existing) throw new Error("Agent not found");

  const promptChanged =
    (input.systemPrompt !== undefined && input.systemPrompt !== existing.systemPrompt) ||
    (input.greeting !== undefined && input.greeting !== existing.greeting) ||
    (input.voice !== undefined && input.voice !== existing.voice) ||
    (input.model !== undefined && input.model !== existing.model);

  const newVersion = promptChanged ? existing.version! + 1 : existing.version!;

  const [updated] = await db
    .update(agents)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
      ...(input.greeting !== undefined ? { greeting: input.greeting } : {}),
      ...(input.voice !== undefined ? { voice: input.voice } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.channels !== undefined ? { channels: input.channels } : {}),
      ...(input.transferPhone !== undefined ? { transferPhone: input.transferPhone } : {}),
      ...(promptChanged ? { version: newVersion } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
    .returning();

  if (promptChanged) {
    await db.insert(agentVersions).values({
      agentId,
      version: newVersion,
      systemPrompt: updated.systemPrompt,
      greeting: updated.greeting,
      voice: updated.voice,
      model: updated.model,
      toolConfig: updated.toolConfig,
      changeNote: `Updated to v${newVersion}`,
      createdBy: userId,
    });
  }

  return updated;
}

export async function deleteAgent(agentId: string, orgId: string) {
  await db
    .update(agents)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)));
}

export async function getAgent(agentId: string, orgId: string) {
  return db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.orgId, orgId)),
  });
}

export async function listAgents(orgId: string) {
  return db.query.agents.findMany({
    where: and(eq(agents.orgId, orgId), eq(agents.isActive, true)),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
}

export async function getAgentVersions(agentId: string) {
  return db.query.agentVersions.findMany({
    where: eq(agentVersions.agentId, agentId),
    orderBy: (v, { desc }) => [desc(v.version)],
  });
}

export async function rollbackAgent(agentId: string, orgId: string, userId: string, targetVersion: number) {
  const version = await db.query.agentVersions.findFirst({
    where: and(
      eq(agentVersions.agentId, agentId),
      eq(agentVersions.version, targetVersion)
    ),
  });

  if (!version) throw new Error("Version not found");

  return updateAgent(agentId, orgId, userId, {
    systemPrompt: version.systemPrompt || "",
    greeting: version.greeting || "",
    voice: version.voice || "shimmer",
    model: version.model || "gpt-5-mini",
  });
}

export async function assignPhoneToAgent(phoneNumberId: string, agentId: string, orgId: string) {
  await db
    .update(phoneNumbers)
    .set({ agentId })
    .where(and(eq(phoneNumbers.id, phoneNumberId), eq(phoneNumbers.orgId, orgId)));
}
