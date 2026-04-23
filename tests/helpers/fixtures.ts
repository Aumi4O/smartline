import type { TestDb } from "./test-db";
import {
  organizations,
  users,
  orgMemberships,
  agents,
  phoneNumbers,
  creditBalances,
} from "@/lib/db/schema";

let seq = 0;
const nextSeq = () => ++seq;

export async function createUser(db: TestDb, overrides: { email?: string; name?: string } = {}) {
  const n = nextSeq();
  const [user] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user${n}@test.local`,
      name: overrides.name ?? `Test User ${n}`,
    })
    .returning();
  return user;
}

export async function createOrg(
  db: TestDb,
  overrides: Partial<{
    name: string;
    slug: string;
    plan: string;
    planStatus: string;
    openaiProjectId: string;
    openaiApiKeyEncrypted: string;
    twilioSubAccountSid: string;
    twilioSubAuthToken: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }> = {}
) {
  const n = nextSeq();
  const [org] = await db
    .insert(organizations)
    .values({
      name: overrides.name ?? `Org ${n}`,
      slug: overrides.slug ?? `org-${n}-${Date.now().toString(36)}`,
      plan: overrides.plan ?? "starter",
      planStatus: overrides.planStatus ?? "active",
      openaiProjectId: overrides.openaiProjectId,
      openaiApiKeyEncrypted: overrides.openaiApiKeyEncrypted,
      twilioSubAccountSid: overrides.twilioSubAccountSid,
      twilioSubAuthToken: overrides.twilioSubAuthToken,
      stripeCustomerId: overrides.stripeCustomerId,
      stripeSubscriptionId: overrides.stripeSubscriptionId,
    })
    .returning();

  await db.insert(creditBalances).values({
    orgId: org.id,
    balanceCents: 0,
  });

  return org;
}

export async function addMembership(
  db: TestDb,
  userId: string,
  orgId: string,
  role: "owner" | "admin" | "member" = "owner"
) {
  await db.insert(orgMemberships).values({ userId, orgId, role });
}

export async function createAgent(
  db: TestDb,
  orgId: string,
  overrides: Partial<{ name: string; isActive: boolean; systemPrompt: string }> = {}
) {
  const n = nextSeq();
  const [agent] = await db
    .insert(agents)
    .values({
      orgId,
      name: overrides.name ?? `Agent ${n}`,
      isActive: overrides.isActive ?? true,
      systemPrompt: overrides.systemPrompt ?? "You are a helpful assistant.",
    })
    .returning();
  return agent;
}

export async function createPhoneNumber(
  db: TestDb,
  orgId: string,
  agentId?: string,
  overrides: Partial<{ phoneNumber: string; twilioSid: string }> = {}
) {
  const n = nextSeq();
  const [pn] = await db
    .insert(phoneNumbers)
    .values({
      orgId,
      agentId,
      phoneNumber: overrides.phoneNumber ?? `+155500${String(n).padStart(5, "0")}`,
      twilioSid: overrides.twilioSid ?? `PN${n.toString().padStart(30, "0")}`,
    })
    .returning();
  return pn;
}

export async function setBalance(db: TestDb, orgId: string, balanceCents: number) {
  await db
    .insert(creditBalances)
    .values({ orgId, balanceCents })
    .onConflictDoUpdate({
      target: creditBalances.orgId,
      set: { balanceCents, updatedAt: new Date() },
    });
}

export async function seedOrg(
  db: TestDb,
  options: {
    orgName?: string;
    balance?: number;
    withAgent?: boolean;
    withPhoneNumber?: boolean;
  } = {}
) {
  const user = await createUser(db);
  const org = await createOrg(db, { name: options.orgName });
  await addMembership(db, user.id, org.id, "owner");
  if (options.balance !== undefined) {
    await setBalance(db, org.id, options.balance);
  }
  const agent = options.withAgent ? await createAgent(db, org.id) : null;
  const phone = options.withPhoneNumber
    ? await createPhoneNumber(db, org.id, agent?.id)
    : null;
  return { user, org, agent, phone };
}
