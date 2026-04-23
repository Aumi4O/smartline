import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const OPENAI_ADMIN_BASE = "https://api.openai.com/v1/organization";

async function openaiAdmin(path: string, method = "GET", body?: unknown) {
  const adminKey = process.env.OPENAI_ADMIN_KEY;
  if (!adminKey) throw new Error("OPENAI_ADMIN_KEY not set");

  const res = await fetch(`${OPENAI_ADMIN_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI Admin API ${res.status}: ${text}`);
  }

  return res.json();
}

export async function createOpenAIProject(orgId: string, orgName: string) {
  const project = await openaiAdmin("/projects", "POST", {
    name: `SmartLine: ${orgName}`,
  });

  const serviceAccount = await openaiAdmin(
    `/projects/${project.id}/service_accounts`,
    "POST",
    { name: `smartline-${orgId.slice(0, 8)}` }
  );

  await db
    .update(organizations)
    .set({
      openaiProjectId: project.id,
      openaiServiceAccountId: serviceAccount.id,
      openaiApiKeyEncrypted: serviceAccount.api_key?.value || "",
      openaiKeyVersion: 1,
      openaiKeyRotatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  return {
    projectId: project.id,
    serviceAccountId: serviceAccount.id,
  };
}

export async function getOrgOpenAIKey(orgId: string): Promise<string> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (org?.openaiApiKeyEncrypted) {
    return org.openaiApiKeyEncrypted;
  }

  return process.env.OPENAI_API_KEY!;
}
