import { db } from "@/lib/db";
import { businessProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface BusinessProfileInput {
  businessName: string;
  industry: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  hoursOfOperation: string;
  services: string;
  pricing: string;
  faq: string;
  policies: string;
  specialInstructions: string;
}

export async function getBusinessProfile(orgId: string) {
  return db.query.businessProfiles.findFirst({
    where: eq(businessProfiles.orgId, orgId),
  });
}

export async function saveBusinessProfile(orgId: string, input: Partial<BusinessProfileInput>) {
  const existing = await getBusinessProfile(orgId);

  if (existing) {
    const [updated] = await db
      .update(businessProfiles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(businessProfiles.orgId, orgId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(businessProfiles)
    .values({ orgId, ...input })
    .returning();
  return created;
}

export function buildSystemPrompt(profile: BusinessProfileInput): string {
  const sections: string[] = [];

  sections.push(`You are a professional AI voice assistant for ${profile.businessName || "this business"}.`);

  if (profile.industry) {
    sections.push(`Industry: ${profile.industry}.`);
  }

  if (profile.description) {
    sections.push(`About the business: ${profile.description}`);
  }

  sections.push("");
  sections.push("INSTRUCTIONS:");
  sections.push("- Be friendly, professional, and helpful.");
  sections.push("- Answer questions using ONLY the business information provided below.");
  sections.push("- If you don't know something, say so honestly and offer to take a message or transfer the call.");
  sections.push("- Never make up information about services, pricing, or availability.");

  if (profile.specialInstructions) {
    sections.push(`- ${profile.specialInstructions}`);
  }

  sections.push("");
  sections.push("BUSINESS INFORMATION:");

  if (profile.address) sections.push(`Address: ${profile.address}`);
  if (profile.phone) sections.push(`Phone: ${profile.phone}`);
  if (profile.email) sections.push(`Email: ${profile.email}`);
  if (profile.website) sections.push(`Website: ${profile.website}`);

  if (profile.hoursOfOperation) {
    sections.push(`\nHours of Operation:\n${profile.hoursOfOperation}`);
  }

  if (profile.services) {
    sections.push(`\nServices Offered:\n${profile.services}`);
  }

  if (profile.pricing) {
    sections.push(`\nPricing:\n${profile.pricing}`);
  }

  if (profile.faq) {
    sections.push(`\nFrequently Asked Questions:\n${profile.faq}`);
  }

  if (profile.policies) {
    sections.push(`\nPolicies:\n${profile.policies}`);
  }

  return sections.join("\n");
}

export function buildKnowledgeText(profile: BusinessProfileInput): string {
  const sections: string[] = [];

  if (profile.businessName) sections.push(`Business Name: ${profile.businessName}`);
  if (profile.industry) sections.push(`Industry: ${profile.industry}`);
  if (profile.description) sections.push(`Description: ${profile.description}`);
  if (profile.address) sections.push(`Address: ${profile.address}`);
  if (profile.phone) sections.push(`Phone: ${profile.phone}`);
  if (profile.email) sections.push(`Email: ${profile.email}`);
  if (profile.website) sections.push(`Website: ${profile.website}`);
  if (profile.hoursOfOperation) sections.push(`Hours of Operation:\n${profile.hoursOfOperation}`);
  if (profile.services) sections.push(`Services:\n${profile.services}`);
  if (profile.pricing) sections.push(`Pricing:\n${profile.pricing}`);
  if (profile.faq) sections.push(`FAQ:\n${profile.faq}`);
  if (profile.policies) sections.push(`Policies:\n${profile.policies}`);
  if (profile.specialInstructions) sections.push(`Special Instructions:\n${profile.specialInstructions}`);

  return sections.join("\n\n");
}
