import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSubAccount } from "./twilio-provisioning";
import { createOpenAIProject } from "./openai-provisioning";

/**
 * Provisions all external resources for an organization.
 * Called after successful activation payment.
 *
 * Idempotent — skips already-provisioned resources.
 */
export async function provisionOrg(orgId: string) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) throw new Error("Organization not found");

  const results: Record<string, string> = {};

  if (!org.twilioSubAccountSid) {
    try {
      const twilio = await createSubAccount(orgId, org.name);
      results.twilio = `sub-account ${twilio.subAccountSid}`;
    } catch (error) {
      console.error(`Twilio provisioning failed for ${orgId}:`, error);
      results.twilio = "failed";
    }
  } else {
    results.twilio = "already provisioned";
  }

  if (!org.openaiProjectId) {
    try {
      const openai = await createOpenAIProject(orgId, org.name);
      results.openai = `project ${openai.projectId}`;
    } catch (error) {
      console.error(`OpenAI provisioning failed for ${orgId}:`, error);
      results.openai = "failed";
    }
  } else {
    results.openai = "already provisioned";
  }

  return results;
}
