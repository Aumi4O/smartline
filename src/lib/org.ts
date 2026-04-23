import { db } from "@/lib/db";
import { organizations, orgMemberships, creditBalances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function getCurrentOrg() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await db.query.orgMemberships.findFirst({
    where: eq(orgMemberships.userId, session.user.id),
    with: { organization: true },
  });

  return membership?.organization ?? null;
}

export async function getOrCreateOrg(userId: string, email: string) {
  const existing = await db.query.orgMemberships.findFirst({
    where: eq(orgMemberships.userId, userId),
    with: { organization: true },
  });

  if (existing?.organization) return existing.organization;

  const slug = email.split("@")[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const [org] = await db.insert(organizations).values({
    name,
    slug: `${slug}-${Date.now().toString(36)}`,
    plan: "starter",
    planStatus: "inactive",
  }).returning();

  await db.insert(orgMemberships).values({
    userId,
    orgId: org.id,
    role: "owner",
  });

  await db.insert(creditBalances).values({
    orgId: org.id,
    balanceCents: 0,
  });

  return org;
}

export async function activateOrg(orgId: string) {
  await db
    .update(organizations)
    .set({ planStatus: "active", updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
}

export async function requireOrg() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const org = await getOrCreateOrg(session.user.id, session.user.email!);
  return { session, org };
}
