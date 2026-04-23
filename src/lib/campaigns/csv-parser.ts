const AREA_CODE_TIMEZONES: Record<string, string> = {
  "201": "America/New_York", "202": "America/New_York", "203": "America/New_York",
  "205": "America/Chicago", "206": "America/Los_Angeles", "207": "America/New_York",
  "208": "America/Boise", "209": "America/Los_Angeles", "210": "America/Chicago",
  "212": "America/New_York", "213": "America/Los_Angeles", "214": "America/Chicago",
  "215": "America/New_York", "216": "America/New_York", "217": "America/Chicago",
  "218": "America/Chicago", "219": "America/Chicago",
  "301": "America/New_York", "302": "America/New_York", "303": "America/Denver",
  "304": "America/New_York", "305": "America/New_York", "307": "America/Denver",
  "308": "America/Chicago", "309": "America/Chicago", "310": "America/Los_Angeles",
  "312": "America/Chicago", "313": "America/Detroit", "314": "America/Chicago",
  "315": "America/New_York", "316": "America/Chicago", "317": "America/Indiana/Indianapolis",
  "318": "America/Chicago", "319": "America/Chicago",
  "401": "America/New_York", "402": "America/Chicago", "404": "America/New_York",
  "405": "America/Chicago", "406": "America/Denver", "407": "America/New_York",
  "408": "America/Los_Angeles", "409": "America/Chicago", "410": "America/New_York",
  "412": "America/New_York", "413": "America/New_York", "414": "America/Chicago",
  "415": "America/Los_Angeles", "417": "America/Chicago", "419": "America/New_York",
  "501": "America/Chicago", "502": "America/New_York", "503": "America/Los_Angeles",
  "504": "America/Chicago", "505": "America/Denver", "507": "America/Chicago",
  "508": "America/New_York", "509": "America/Los_Angeles", "510": "America/Los_Angeles",
  "512": "America/Chicago", "513": "America/New_York", "515": "America/Chicago",
  "516": "America/New_York", "517": "America/Detroit", "518": "America/New_York",
  "520": "America/Phoenix", "530": "America/Los_Angeles",
  "601": "America/Chicago", "602": "America/Phoenix", "603": "America/New_York",
  "605": "America/Chicago", "606": "America/New_York", "607": "America/New_York",
  "608": "America/Chicago", "609": "America/New_York", "610": "America/New_York",
  "612": "America/Chicago", "614": "America/New_York", "615": "America/Chicago",
  "616": "America/Detroit", "617": "America/New_York", "618": "America/Chicago",
  "619": "America/Los_Angeles",
  "701": "America/Chicago", "702": "America/Los_Angeles", "703": "America/New_York",
  "704": "America/New_York", "706": "America/New_York", "707": "America/Los_Angeles",
  "708": "America/Chicago", "712": "America/Chicago", "713": "America/Chicago",
  "714": "America/Los_Angeles", "715": "America/Chicago", "716": "America/New_York",
  "717": "America/New_York", "718": "America/New_York", "719": "America/Denver",
  "720": "America/Denver",
  "801": "America/Denver", "802": "America/New_York", "803": "America/New_York",
  "804": "America/New_York", "805": "America/Los_Angeles", "806": "America/Chicago",
  "808": "Pacific/Honolulu", "810": "America/Detroit", "812": "America/Indiana/Indianapolis",
  "813": "America/New_York", "814": "America/New_York", "815": "America/Chicago",
  "816": "America/Chicago", "817": "America/Chicago", "818": "America/Los_Angeles",
  "901": "America/Chicago", "903": "America/Chicago", "904": "America/New_York",
  "906": "America/Detroit", "907": "America/Anchorage", "908": "America/New_York",
  "909": "America/Los_Angeles", "910": "America/New_York", "912": "America/New_York",
  "913": "America/Chicago", "914": "America/New_York", "915": "America/Denver",
  "916": "America/Los_Angeles", "917": "America/New_York", "918": "America/Chicago",
  "919": "America/New_York", "920": "America/Chicago",
};

export function detectTimezone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const areaCode = digits.startsWith("1") ? digits.slice(1, 4) : digits.slice(0, 3);
  return AREA_CODE_TIMEZONES[areaCode] || "America/New_York";
}

export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11 && digits.startsWith("1")) return `+${digits.slice(0, 11)}`;
  if (digits.length < 10) return null;
  return `+${digits}`;
}

export interface ParsedLead {
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
  timezone: string;
}

const HEADER_MAP: Record<string, string> = {
  "first_name": "firstName", "firstname": "firstName", "first": "firstName", "name": "firstName",
  "last_name": "lastName", "lastname": "lastName", "last": "lastName", "surname": "lastName",
  "phone": "phone", "phone_number": "phone", "phonenumber": "phone", "mobile": "phone",
  "cell": "phone", "telephone": "phone", "tel": "phone", "number": "phone",
  "email": "email", "email_address": "email", "emailaddress": "email", "e-mail": "email",
  "company": "company", "business": "company", "organization": "company", "org": "company",
  "company_name": "company", "companyname": "company",
  "notes": "notes", "note": "notes", "comments": "notes", "comment": "notes", "description": "notes",
};

export function parseCSV(csvText: string): { leads: ParsedLead[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { leads: [], errors: ["CSV must have a header row and at least one data row"] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const fieldMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const mapped = HEADER_MAP[h];
    if (mapped) fieldMap[i] = mapped;
  });

  if (!Object.values(fieldMap).includes("phone")) {
    return { leads: [], errors: ["CSV must have a phone/phone_number/mobile column"] };
  }

  const leads: ParsedLead[] = [];
  const errors: string[] = [];
  const seenPhones = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    values.forEach((v, j) => {
      const field = fieldMap[j];
      if (field) row[field] = v.trim();
    });

    if (!row.phone) {
      errors.push(`Row ${i + 1}: missing phone number`);
      continue;
    }

    const normalizedPhone = normalizePhone(row.phone);
    if (!normalizedPhone) {
      errors.push(`Row ${i + 1}: invalid phone "${row.phone}"`);
      continue;
    }

    if (seenPhones.has(normalizedPhone)) {
      errors.push(`Row ${i + 1}: duplicate phone ${normalizedPhone}`);
      continue;
    }
    seenPhones.add(normalizedPhone);

    leads.push({
      firstName: row.firstName || undefined,
      lastName: row.lastName || undefined,
      phone: normalizedPhone,
      email: row.email || undefined,
      company: row.company || undefined,
      notes: row.notes || undefined,
      timezone: detectTimezone(normalizedPhone),
    });
  }

  return { leads, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}
