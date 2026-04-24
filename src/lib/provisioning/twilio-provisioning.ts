import { db } from "@/lib/db";
import { organizations, phoneNumbers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getMasterClient, getSubAccountClient } from "@/lib/twilio";

const OPENAI_SIP_URI = "sip.openai.com";

export async function createSubAccount(orgId: string, orgName: string) {
  const client = getMasterClient();

  const subAccount = await client.api.v2010.accounts.create({
    friendlyName: `SmartLine: ${orgName}`,
  });

  let trunkSid: string | null = null;
  try {
    const trunk = await client.trunking.v1.trunks.create({
      friendlyName: `${orgName} SIP Trunk`,
      domainName: `${orgId.slice(0, 8)}.pstn.twilio.com`,
    });

    await client.trunking.v1
      .trunks(trunk.sid)
      .originationUrls.create({
        friendlyName: "OpenAI Realtime",
        sipUrl: `sip:+@${OPENAI_SIP_URI}`,
        priority: 1,
        weight: 1,
        enabled: true,
      });

    trunkSid = trunk.sid;
  } catch (err) {
    console.warn(
      `[twilio] SIP trunk skipped for org ${orgId} — Media Streams flow will still work.`,
      err instanceof Error ? err.message : err
    );
  }

  await db
    .update(organizations)
    .set({
      twilioSubAccountSid: subAccount.sid,
      twilioSubAuthToken: subAccount.authToken,
      ...(trunkSid ? { twilioSipTrunkSid: trunkSid } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  return {
    subAccountSid: subAccount.sid,
    authToken: subAccount.authToken,
    trunkSid,
  };
}

export async function searchAvailableNumbers(
  areaCode?: string,
  country = "US",
  limit = 10
) {
  const client = getMasterClient();

  const params: Record<string, unknown> = { limit };
  if (areaCode) params.areaCode = areaCode;

  const numbers = await client
    .availablePhoneNumbers(country)
    .local.list(params);

  return numbers.map((n) => ({
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    locality: n.locality,
    region: n.region,
    capabilities: {
      voice: n.capabilities.voice,
      sms: n.capabilities.sms,
    },
  }));
}

export async function purchasePhoneNumber(
  orgId: string,
  number: string,
  agentId?: string
) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org?.twilioSubAccountSid || !org?.twilioSubAuthToken) {
    throw new Error("Twilio sub-account not provisioned");
  }

  const subClient = getSubAccountClient(
    org.twilioSubAccountSid,
    org.twilioSubAuthToken
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const purchased = await subClient.incomingPhoneNumbers.create({
    phoneNumber: number,
    voiceUrl: `${appUrl}/api/twilio/voice`,
    voiceMethod: "POST",
    smsUrl: `${appUrl}/api/twilio/sms`,
    smsMethod: "POST",
    statusCallback: `${appUrl}/api/twilio/status`,
    statusCallbackMethod: "POST",
  });

  // Do NOT attach this number to org.twilioSipTrunkSid: that trunk (if any) is created on the
  // *master* account in createSubAccount, while the number lives on the *sub-account*. Twilio
  // requires the trunk and number in the same account. Inbound voice uses voiceUrl (Media
  // Streams) and does not need trunk ↔ number linking for this architecture.

  const [row] = await db
    .insert(phoneNumbers)
    .values({
      orgId,
      agentId: agentId ?? null,
      phoneNumber: purchased.phoneNumber,
      twilioSid: purchased.sid,
      capabilities: ["voice", "sms"],
      monthlyCostCents: 180,
      status: "active",
    })
    .returning();

  return row;
}

export async function releasePhoneNumber(phoneNumberId: string) {
  const row = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.id, phoneNumberId),
  });

  if (!row) throw new Error("Phone number not found");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, row.orgId),
  });

  if (org?.twilioSubAccountSid && org?.twilioSubAuthToken) {
    const subClient = getSubAccountClient(
      org.twilioSubAccountSid,
      org.twilioSubAuthToken
    );
    try {
      await subClient.incomingPhoneNumbers(row.twilioSid).remove();
    } catch {
      console.warn(`Failed to release ${row.phoneNumber} from Twilio`);
    }
  }

  await db
    .update(phoneNumbers)
    .set({ status: "released" })
    .where(eq(phoneNumbers.id, phoneNumberId));
}

export async function listOrgPhoneNumbers(orgId: string) {
  return db.query.phoneNumbers.findMany({
    where: eq(phoneNumbers.orgId, orgId),
  });
}
