#!/usr/bin/env node
// Applies scripts/enable-rls.sql to the database in DATABASE_URL.
// Usage: node scripts/run-rls.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import dotenv from "dotenv";

// Load .env.local first, fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Check .env.local");
  process.exit(1);
}

const sqlFile = path.join(__dirname, "enable-rls.sql");
const sqlText = fs.readFileSync(sqlFile, "utf8");

// Split into individual statements (simple split on ';' at line end).
const statements = sqlText
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

async function main() {
  console.log(`Connecting to ${DATABASE_URL.split("@")[1]?.split("/")[0] ?? "db"}...`);
  let applied = 0;
  let lastResult = null;
  for (const stmt of statements) {
    try {
      const result = await sql.unsafe(stmt + ";");
      applied++;
      if (stmt.toLowerCase().startsWith("select")) {
        lastResult = result;
      }
    } catch (err) {
      console.error(`❌ Statement failed:\n${stmt.slice(0, 120)}...`);
      console.error(`   Error: ${err.message}`);
      throw err;
    }
  }

  console.log(`✅ Applied ${applied} statements.\n`);
  if (lastResult) {
    console.log("Table RLS status:");
    console.table(
      lastResult.map((r) => ({
        table: r.tablename,
        rls_enabled: r.rls_enabled,
        rls_forced: r.rls_forced,
      }))
    );
  }
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
