import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import fs from "node:fs";
import path from "node:path";

export type TestDb = ReturnType<typeof drizzlePglite<typeof schema>>;

let pglite: PGlite | null = null;
let testDb: TestDb | null = null;

/**
 * Build a deterministic subset of the drizzle SQL migration that PGlite can
 * execute. We deliberately skip the `inet` type (not supported by pglite by
 * default) and swap it for `text` so audit_logs works.
 */
function loadMigrationSQL(): string {
  const migrationPath = path.resolve(
    __dirname,
    "../../drizzle/0000_colossal_longshot.sql"
  );
  const raw = fs.readFileSync(migrationPath, "utf-8");
  return raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((stmt) => stmt.replace(/"inet"/g, "text").replace(/\binet\b/g, "text"))
    .join("\n");
}

export async function getTestDb(): Promise<TestDb> {
  if (testDb) return testDb;

  pglite = new PGlite();
  testDb = drizzlePglite(pglite, { schema });

  const sql = loadMigrationSQL();
  const statements = sql
    .split(/;\s*(?=CREATE |ALTER |DROP |INSERT )/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    const final = stmt.endsWith(";") ? stmt : stmt + ";";
    try {
      await pglite.exec(final);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|does not exist/i.test(msg)) {
        throw new Error(`Migration failed on: ${final.slice(0, 100)}... -> ${msg}`);
      }
    }
  }

  return testDb;
}

export async function resetTestDb() {
  if (!pglite) {
    await getTestDb();
    return;
  }
  const tables = [
    "messages",
    "conversations",
    "credit_transactions",
    "credit_balances",
    "leads",
    "campaigns",
    "knowledge_chunks",
    "knowledge_documents",
    "webhook_endpoints",
    "audit_logs",
    "consent_records",
    "agent_versions",
    "phone_numbers",
    "agents",
    "business_profiles",
    "org_memberships",
    "sessions",
    "accounts",
    "verification_tokens",
    "organizations",
    "users",
  ];
  for (const t of tables) {
    try {
      await pglite.exec(`DELETE FROM "${t}";`);
    } catch {
      // ignore if table doesn't exist
    }
  }
}

export async function closeTestDb() {
  if (pglite) {
    await pglite.close();
    pglite = null;
    testDb = null;
  }
}
