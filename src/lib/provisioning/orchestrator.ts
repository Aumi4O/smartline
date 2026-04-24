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

  // Skip per-tenant OpenAI project provisioning when the operator has
  // explicitly opted into using only the shared OPENAI_SIP_PROJECT_ID.
  // Also skip if OPENAI_ADMIN_KEY is missing, so we don't spam 403s into
  // the logs — the shared project fallback handles the call just fine.
  const useSharedProject =
    process.env.OPENAI_AUTO_PROVISION === "0" ||
    !process.env.OPENAI_ADMIN_KEY;

  if (!org.openaiProjectId && !useSharedProject) {
    try {
      const openai = await createOpenAIProject(orgId, org.name);
      results.openai = `project ${openai.projectId}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Missing admin scopes is a configuration choice, not a bug. Log
      // once at info level and move on — the shared project picks up.
      if (msg.includes("api.management.write") || msg.includes("403")) {
        console.log(
          `[provisioning] skipping per-tenant OpenAI project for ${orgId}: admin key lacks api.management.write — using OPENAI_SIP_PROJECT_ID fallback.`
        );
        results.openai = "shared-fallback";
      } else {
        console.error(`OpenAI provisioning failed for ${orgId}:`, error);
        results.openai = "failed";
      }
    }
  } else if (useSharedProject) {
    results.openai = "shared-fallback";
  } else {
    results.openai = "already provisioned";
  }

  return results;
}
