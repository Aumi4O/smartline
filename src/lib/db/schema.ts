import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  jsonb,
  inet,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ORGANIZATIONS (tenants)
// ============================================================
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),

  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("trial"),
  planStatus: text("plan_status").notNull().default("trialing"),

  twilioSubAccountSid: text("twilio_sub_account_sid").unique(),
  twilioSubAuthToken: text("twilio_sub_auth_token"),
  twilioSipTrunkSid: text("twilio_sip_trunk_sid"),

  openaiProjectId: text("openai_project_id").unique(),
  openaiServiceAccountId: text("openai_service_account_id"),
  openaiApiKeyEncrypted: text("openai_api_key_encrypted"),
  openaiKeyVersion: integer("openai_key_version").default(1),
  openaiKeyRotatedAt: timestamp("openai_key_rotated_at", { withTimezone: true }),

  dataRetentionDays: integer("data_retention_days").default(90),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// USERS
// ============================================================
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Auth.js required tables
export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ============================================================
// ORG MEMBERSHIPS
// ============================================================
export const orgMemberships = pgTable("org_memberships", {
  userId: uuid("user_id").notNull().references(() => users.id),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  role: text("role").notNull().default("member"),
}, (table) => [
  primaryKey({ columns: [table.userId, table.orgId] }),
]);

// ============================================================
// BUSINESS PROFILES
// ============================================================
export const businessProfiles = pgTable("business_profiles", {
  orgId: uuid("org_id").primaryKey().references(() => organizations.id),
  businessName: text("business_name").notNull().default(""),
  industry: text("industry").default(""),
  description: text("description").default(""),
  address: text("address").default(""),
  phone: text("phone").default(""),
  email: text("email").default(""),
  website: text("website").default(""),
  hoursOfOperation: text("hours_of_operation").default(""),
  services: text("services").default(""),
  pricing: text("pricing").default(""),
  faq: text("faq").default(""),
  policies: text("policies").default(""),
  specialInstructions: text("special_instructions").default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// AGENTS
// ============================================================
export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt"),
  greeting: text("greeting"),
  voice: text("voice").default("shimmer"),
  model: text("model").default("gpt-5-mini"),
  voiceModel: text("voice_model").default("gpt-realtime"),
  language: text("language").default("en"),
  secondaryLanguages: jsonb("secondary_languages").default([]),
  isActive: boolean("is_active").default(true),
  channels: jsonb("channels").default(["web"]),
  toolConfig: jsonb("tool_config").default([]),
  transferPhone: text("transfer_phone"),
  version: integer("version").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentVersions = pgTable("agent_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  systemPrompt: text("system_prompt"),
  greeting: text("greeting"),
  voice: text("voice"),
  model: text("model"),
  toolConfig: jsonb("tool_config"),
  changeNote: text("change_note"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("agent_version_unique").on(table.agentId, table.version),
]);

// ============================================================
// PHONE NUMBERS
// ============================================================
export const phoneNumbers = pgTable("phone_numbers", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  agentId: uuid("agent_id").references(() => agents.id),
  phoneNumber: text("phone_number").unique().notNull(),
  twilioSid: text("twilio_sid").unique().notNull(),
  capabilities: jsonb("capabilities").default(["voice", "sms"]),
  monthlyCostCents: integer("monthly_cost_cents").default(150),
  status: text("status").default("active"),
  portStatus: text("port_status"),
  forwardedFrom: text("forwarded_from"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// KNOWLEDGE BASE
// ============================================================
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  status: text("status").default("processing"),
  chunkCount: integer("chunk_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  // pgvector column added via raw SQL migration (Drizzle doesn't natively support vector type)
  metadata: jsonb("metadata").default({}),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// CONVERSATIONS + MESSAGES
// ============================================================
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  channel: text("channel").default("web"),
  callerPhone: text("caller_phone"),
  status: text("status").default("active"),
  summary: text("summary"),
  actionItems: jsonb("action_items").default([]),
  sentiment: text("sentiment"),
  leadScore: integer("lead_score"),
  durationSec: integer("duration_sec"),
  costCents: integer("cost_cents"),
  transferredTo: text("transferred_to"),
  metadata: jsonb("metadata").default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  contentRedacted: text("content_redacted"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// CREDITS
// ============================================================
export const creditBalances = pgTable("credit_balances", {
  orgId: uuid("org_id").primaryKey().references(() => organizations.id),
  balanceCents: bigint("balance_cents", { mode: "number" }).notNull().default(0),
  autoTopup: boolean("auto_topup").default(false),
  topupAmount: integer("topup_amount").default(2500),
  topupThreshold: integer("topup_threshold").default(500),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  type: text("type").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_credit_tx_org").on(table.orgId, table.createdAt),
]);

// ============================================================
// CAMPAIGNS
// ============================================================
export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  name: text("name").notNull(),
  status: text("status").default("draft"),
  outboundPrompt: text("outbound_prompt"),
  callFromNumberId: uuid("call_from_number_id").references(() => phoneNumbers.id),
  schedule: jsonb("schedule").default({}),
  maxConcurrent: integer("max_concurrent").default(1),
  maxCallsPerHour: integer("max_calls_per_hour").default(30),
  voicemailAction: text("voicemail_action").default("leave_message"),
  voicemailMessage: text("voicemail_message"),
  retryDelayMinutes: integer("retry_delay_minutes").default(60),
  maxAttempts: integer("max_attempts").default(3),
  totalLeads: integer("total_leads").default(0),
  completedLeads: integer("completed_leads").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// LEADS
// ============================================================
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone").notNull(),
  email: text("email"),
  company: text("company"),
  notes: text("notes"),
  status: text("status").default("new"),
  callAttempts: integer("call_attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastCalledAt: timestamp("last_called_at", { withTimezone: true }),
  lastConversationId: uuid("last_conversation_id"),
  outcome: text("outcome"),
  leadScore: integer("lead_score"),
  timezone: text("timezone"),
  customFields: jsonb("custom_fields").default({}),
  consentGranted: boolean("consent_granted").default(false),
  doNotCall: boolean("do_not_call").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_leads_org_status").on(table.orgId, table.status),
  index("idx_leads_campaign").on(table.campaignId, table.status),
  index("idx_leads_phone").on(table.orgId, table.phone),
]);

// ============================================================
// COMPLIANCE: CONSENT + AUDIT
// ============================================================
export const consentRecords = pgTable("consent_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  phoneNumber: text("phone_number").notNull(),
  consentType: text("consent_type").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  source: text("source").notNull(),
  metadata: jsonb("metadata").default({}),
}, (table) => [
  index("idx_consent_phone").on(table.phoneNumber, table.consentType),
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  ipAddress: inet("ip_address"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_audit_org").on(table.orgId, table.createdAt),
]);

// ============================================================
// WEBHOOK ENDPOINTS (subscriber-configured)
// ============================================================
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  url: text("url").notNull(),
  events: jsonb("events").default(["call.completed"]),
  secret: text("secret").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// RELATIONS
// ============================================================
export const businessProfilesRelations = relations(businessProfiles, ({ one }) => ({
  organization: one(organizations, { fields: [businessProfiles.orgId], references: [organizations.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(orgMemberships),
  agents: many(agents),
  phoneNumbers: many(phoneNumbers),
  creditBalance: many(creditBalances),
  creditTransactions: many(creditTransactions),
  businessProfile: many(businessProfiles),
  conversations: many(conversations),
  campaigns: many(campaigns),
  leads: many(leads),
  consentRecords: many(consentRecords),
  auditLogs: many(auditLogs),
  webhookEndpoints: many(webhookEndpoints),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(orgMemberships),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  user: one(users, { fields: [orgMemberships.userId], references: [users.id] }),
  organization: one(organizations, { fields: [orgMemberships.orgId], references: [organizations.id] }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, { fields: [agents.orgId], references: [organizations.id] }),
  versions: many(agentVersions),
  phoneNumbers: many(phoneNumbers),
  knowledgeDocuments: many(knowledgeDocuments),
  conversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
  organization: one(organizations, { fields: [conversations.orgId], references: [organizations.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  organization: one(organizations, { fields: [campaigns.orgId], references: [organizations.id] }),
  agent: one(agents, { fields: [campaigns.agentId], references: [agents.id] }),
  callFromNumber: one(phoneNumbers, { fields: [campaigns.callFromNumberId], references: [phoneNumbers.id] }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  organization: one(organizations, { fields: [leads.orgId], references: [organizations.id] }),
  campaign: one(campaigns, { fields: [leads.campaignId], references: [campaigns.id] }),
}));
