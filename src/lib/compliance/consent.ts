import { db } from "@/lib/db";
import { consentRecords } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function hasConsent(
  orgId: string,
  phoneNumber: string,
  consentType: "recording" | "marketing" | "sms"
): Promise<boolean> {
  const record = await db.query.consentRecords.findFirst({
    where: and(
      eq(consentRecords.orgId, orgId),
      eq(consentRecords.phoneNumber, phoneNumber),
      eq(consentRecords.consentType, consentType),
      isNull(consentRecords.revokedAt)
    ),
  });

  return !!record;
}

export async function grantConsent(
  orgId: string,
  phoneNumber: string,
  consentType: "recording" | "marketing" | "sms",
  source: string
) {
  const existing = await hasConsent(orgId, phoneNumber, consentType);
  if (existing) return;

  await db.insert(consentRecords).values({
    orgId,
    phoneNumber,
    consentType,
    grantedAt: new Date(),
    source,
  });
}

export async function revokeConsent(
  orgId: string,
  phoneNumber: string,
  consentType: "recording" | "marketing" | "sms"
) {
  await db
    .update(consentRecords)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(consentRecords.orgId, orgId),
        eq(consentRecords.phoneNumber, phoneNumber),
        eq(consentRecords.consentType, consentType),
        isNull(consentRecords.revokedAt)
      )
    );
}

export function getRecordingDisclosure(): string {
  return "This call may be recorded for quality and training purposes. By continuing, you consent to recording.";
}
