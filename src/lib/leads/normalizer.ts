import { normalizePhone, normalizeSegment, detectTimezone } from "@/lib/campaigns/csv-parser";

/**
 * Shape we insert into `leads`. Matches the Drizzle insert type.
 */
export interface NormalizedLead {
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  timezone: string | null;
  segment: string | null;
  source: string;
  customFields: Record<string, unknown>;
}

/**
 * We accept a bunch of shapes because every CRM emits leads differently:
 *
 *   1. Generic flat JSON:
 *        { phone, email, first_name, last_name, company, source?, segment? }
 *
 *   2. Facebook Lead Ads (Zapier-flattened):
 *        {
 *          "full_name": "Jane Doe",
 *          "phone_number": "+15551234",
 *          "email": "jane@x.com",
 *          "form_name": "Oct Campaign",
 *          "ad_name": "Ad 01",
 *          ...
 *        }
 *
 *   3. Facebook Lead Ads raw (field_data array):
 *        {
 *          "field_data": [
 *            { "name": "full_name", "values": ["Jane Doe"] },
 *            { "name": "phone_number", "values": ["+15551234"] },
 *            { "name": "email", "values": ["jane@x.com"] }
 *          ],
 *          "form_id": "...",
 *          "ad_id": "..."
 *        }
 *
 *   4. HubSpot/Salesforce-ish:
 *        { "properties": { "firstname": "Jane", "phone": "+1..." } }
 *
 * We just look at all of them and pick the best available value for each field.
 * Anything we don't recognize gets stashed in customFields so nothing is lost.
 */
export function normalizeInboundLead(
  payload: Record<string, unknown>
): NormalizedLead | { error: string } {
  const flat = flatten(payload);

  const phoneRaw =
    pick(flat, [
      "phone",
      "phone_number",
      "phonenumber",
      "mobile",
      "mobile_phone",
      "cellphone",
      "tel",
      "telefono",
      "contact_phone",
    ]) || "";

  const phone = normalizePhone(String(phoneRaw));
  if (!phone) {
    return { error: "Missing or invalid phone number" };
  }

  const email = pick(flat, ["email", "email_address", "e_mail", "contact_email"]);

  const fullName = pick(flat, ["full_name", "fullname", "name", "contact_name"]);
  let firstName = pick(flat, ["first_name", "firstname", "fname", "given_name"]);
  let lastName = pick(flat, ["last_name", "lastname", "lname", "family_name", "surname"]);

  if (!firstName && fullName) {
    const parts = String(fullName).trim().split(/\s+/);
    firstName = parts[0] || null;
    if (!lastName && parts.length > 1) {
      lastName = parts.slice(1).join(" ");
    }
  }

  const company = pick(flat, ["company", "company_name", "business", "organization", "org"]);
  const notes = pick(flat, ["notes", "message", "comments", "details", "description"]);

  const segmentRaw = pick(flat, [
    "segment",
    "tag",
    "list",
    "group",
    "category",
    "type",
    "form_name",
    "form_id",
    "ad_name",
    "campaign_name",
    "source_list",
  ]);
  const segment =
    normalizeSegment(typeof segmentRaw === "string" ? segmentRaw : undefined) ??
    null;

  const source =
    (pick(flat, ["source", "utm_source", "referrer", "provider", "channel"]) as string) ||
    inferSource(flat) ||
    "webhook";

  const timezoneRaw = pick(flat, ["timezone", "tz", "time_zone"]);
  const timezone =
    typeof timezoneRaw === "string" && timezoneRaw.trim().length > 0
      ? timezoneRaw.trim()
      : detectTimezone(phone);

  return {
    firstName: firstName ? String(firstName).slice(0, 120) : null,
    lastName: lastName ? String(lastName).slice(0, 120) : null,
    phone,
    email: email ? String(email).slice(0, 200) : null,
    company: company ? String(company).slice(0, 200) : null,
    notes: notes ? String(notes).slice(0, 2000) : null,
    timezone,
    segment,
    source,
    customFields: {
      ...(segment ? { segment } : {}),
      raw: trimRaw(payload),
    },
  };
}

function inferSource(flat: Record<string, unknown>): string | null {
  if ("form_id" in flat || "ad_id" in flat || "page_id" in flat) return "facebook_lead_ads";
  if ("hubspot_id" in flat || "portal_id" in flat) return "hubspot";
  if ("salesforce_id" in flat) return "salesforce";
  return null;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined && v !== null && String(v).trim().length > 0) return v;
  }
  return null;
}

function trimRaw(obj: unknown): unknown {
  try {
    const json = JSON.stringify(obj);
    if (json.length > 4000) return { note: "payload too large to store inline" };
    return obj;
  } catch {
    return null;
  }
}

/**
 * Produces a case-insensitive flat view that also unwraps:
 *   - nested `properties` object (HubSpot/Salesforce)
 *   - FB Lead Ads `field_data` array of { name, values }
 *   - any top-level object one level deep
 */
function flatten(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const assign = (k: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      const first = v[0];
      out[k.toLowerCase()] = typeof first === "object" ? JSON.stringify(first) : first;
      return;
    }
    if (typeof v === "object") {
      out[k.toLowerCase()] = JSON.stringify(v);
      return;
    }
    out[k.toLowerCase()] = v;
  };

  for (const [k, v] of Object.entries(obj)) {
    assign(k, v);
  }

  const fieldData = obj["field_data"];
  if (Array.isArray(fieldData)) {
    for (const entry of fieldData) {
      if (
        entry &&
        typeof entry === "object" &&
        "name" in entry &&
        "values" in entry
      ) {
        const name = String((entry as { name: unknown }).name).toLowerCase();
        const values = (entry as { values: unknown }).values;
        if (Array.isArray(values) && values.length > 0) {
          out[name] = values[0];
        }
      }
    }
  }

  const properties = obj["properties"];
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    for (const [k, v] of Object.entries(properties as Record<string, unknown>)) {
      assign(k, v);
    }
  }

  return out;
}
