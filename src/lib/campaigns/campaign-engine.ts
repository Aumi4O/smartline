import { db } from "@/lib/db";
import { campaigns, leads, phoneNumbers, organizations } from "@/lib/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { runAllChecks } from "./tcpa";
import { getSubAccountClient } from "@/lib/twilio";
import { parseSchedule, isInsideCallWindow } from "./schedule";

export async function getNextLeadsToCall(
  campaignId: string,
  limit: number,
  opts?: { segment?: string | null }
): Promise<(typeof leads.$inferSelect)[]> {
  const conditions = [
    eq(leads.campaignId, campaignId),
    or(eq(leads.status, "new"), eq(leads.status, "queued")),
    eq(leads.doNotCall, false),
  ];
  if (opts?.segment) {
    conditions.push(sql`${leads.customFields}->>'segment' = ${opts.segment}`);
  }

  return db.query.leads.findMany({
    where: and(...conditions),
    orderBy: (l, { asc }) => [asc(l.createdAt)],
    limit,
  });
}

export async function initiateOutboundCall(
  campaignId: string,
  leadId: string
): Promise<{ success: boolean; error?: string; callSid?: string }> {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  if (!campaign || campaign.status !== "active") {
    return { success: false, error: "Campaign is not active" };
  }

  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return { success: false, error: "Lead not found" };

  // Campaign-level call window (quiet hours / allowed weekdays).
  const schedule = parseSchedule(campaign.schedule);
  const leadTz = lead.timezone || schedule.callWindow.fallbackTimezone;
  const windowCheck = isInsideCallWindow(schedule.callWindow, leadTz);
  if (!windowCheck.allowed) {
    return { success: false, error: `Window blocked: ${windowCheck.reason}` };
  }

  const tcpaCheck = runAllChecks(lead, campaign.retryDelayMinutes ?? 60);
  if (!tcpaCheck.allowed) {
    return { success: false, error: `TCPA blocked: ${tcpaCheck.reason}` };
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, campaign.orgId),
  });
  if (!org?.twilioSubAccountSid || !org?.twilioSubAuthToken) {
    return { success: false, error: "Twilio sub-account not provisioned" };
  }

  let fromNumber: string | null = null;
  if (campaign.callFromNumberId) {
    const pn = await db.query.phoneNumbers.findFirst({
      where: eq(phoneNumbers.id, campaign.callFromNumberId),
    });
    fromNumber = pn?.phoneNumber || null;
  }
  if (!fromNumber) {
    const anyNumber = await db.query.phoneNumbers.findFirst({
      where: and(eq(phoneNumbers.orgId, campaign.orgId), eq(phoneNumbers.status, "active")),
    });
    fromNumber = anyNumber?.phoneNumber || null;
  }
  if (!fromNumber) {
    return { success: false, error: "No phone number available for outbound calls" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  await db
    .update(leads)
    .set({ status: "calling", updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  try {
    const subClient = getSubAccountClient(org.twilioSubAccountSid, org.twilioSubAuthToken);

    const call = await subClient.calls.create({
      to: lead.phone,
      from: fromNumber,
      url: `${appUrl}/api/twilio/outbound?campaignId=${campaignId}&leadId=${leadId}`,
      statusCallback: `${appUrl}/api/twilio/outbound-status?campaignId=${campaignId}&leadId=${leadId}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      machineDetection: "DetectMessageEnd",
      machineDetectionTimeout: 5,
    });

    await db
      .update(leads)
      .set({
        callAttempts: sql`${leads.callAttempts} + 1`,
        lastCalledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    return { success: true, callSid: call.sid };
  } catch (error) {
    await db
      .update(leads)
      .set({
        status: "failed",
        callAttempts: sql`${leads.callAttempts} + 1`,
        lastCalledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    return { success: false, error: error instanceof Error ? error.message : "Call initiation failed" };
  }
}

export async function processCampaignBatch(campaignId: string): Promise<number> {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  if (!campaign || campaign.status !== "active") return 0;

  const schedule = parseSchedule(campaign.schedule);
  const maxConcurrent = Math.max(1, Math.min(campaign.maxConcurrent ?? 1, 10));

  // Fast-fail: if the campaign's fallback-timezone clock is outside the call
  // window today, skip the batch entirely. Per-lead timezone is still checked
  // inside initiateOutboundCall before each call — we just avoid a DB fetch
  // if there's no chance today.
  const fallbackWindow = isInsideCallWindow(
    schedule.callWindow,
    schedule.callWindow.fallbackTimezone
  );
  if (!fallbackWindow.allowed) {
    console.info(
      `Campaign ${campaignId}: batch skipped — ${fallbackWindow.reason}`
    );
    return 0;
  }

  const eligibleLeads = await getNextLeadsToCall(campaignId, maxConcurrent, {
    segment: schedule.leadSegmentFilter,
  });

  let initiated = 0;

  for (const lead of eligibleLeads) {
    const result = await initiateOutboundCall(campaignId, lead.id);
    if (result.success) {
      initiated++;
    } else {
      console.warn(
        `Campaign ${campaignId}: skipped lead ${lead.id} — ${result.error}`
      );
    }
  }

  return initiated;
}

export async function updateCampaignProgress(campaignId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} IN ('completed', 'voicemail', 'no_answer', 'failed'))`,
    })
    .from(leads)
    .where(eq(leads.campaignId, campaignId));

  await db
    .update(campaigns)
    .set({
      totalLeads: stats.total,
      completedLeads: stats.completed,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  if (stats.total > 0 && stats.completed >= stats.total) {
    await db
      .update(campaigns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }
}
