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

  // OpenAI per-tenant project creation is an OPTIONAL feature.
  //
  // The ONLY way it runs is when the operator has BOTH:
  //   (a) set OPENAI_ADMIN_KEY (a real `sk-admin-...` key), AND
  //   (b) explicitly opted in via OPENAI_AUTO_PROVISION=1
  //
  // In every other configuration we silently use the shared-project path
  // via OPENAI_SIP_PROJECT_ID, which is what production actually uses.
  // This avoids calling the Admin API and makes the 403 "Missing scopes:
  // api.management.write" log line structurally impossible to emit.
  const autoProvisionOpenAI =
    process.env.OPENAI_AUTO_PROVISION === "1" &&
    !!process.env.OPENAI_ADMIN_KEY;

  if (org.openaiProjectId) {
    results.openai = "already provisioned";
  } else if (!autoProvisionOpenAI) {
    results.openai = "shared-fallback";
  } else {
    try {
      const openai = await createOpenAIProject(orgId, org.name);
      results.openai = `project ${openai.projectId}`;
    } catch (error) {
      console.error(`OpenAI provisioning failed for ${orgId}:`, error);
      results.openai = "failed";
    }
  }

  return results;
}
