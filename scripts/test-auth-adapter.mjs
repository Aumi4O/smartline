#!/usr/bin/env node
// Simulates what the Auth.js Drizzle adapter does during Google sign-in.
// Uses the EXACT same DATABASE_URL as production.
import postgres from "postgres";
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const suffix = crypto.randomBytes(4).toString("hex");

try {
  console.log("Connected as:", (await sql`SELECT current_user, current_database()`)[0]);

  console.log("\n1. INSERT into users (like adapter.createUser)…");
  const [user] = await sql`
    INSERT INTO users (email, name, image, email_verified)
    VALUES (${`adapter-test-${suffix}@smartlineagent.com`}, 'Adapter Test', 'https://x/y.png', NOW())
    RETURNING id, email
  `;
  console.log("   ✅", user);

  console.log("\n2. INSERT into accounts (like adapter.linkAccount)…");
  await sql`
    INSERT INTO accounts (user_id, type, provider, provider_account_id, access_token)
    VALUES (${user.id}, 'oauth', 'google', ${`google-${suffix}`}, 'fake_token')
  `;
  console.log("   ✅ account linked");

  console.log("\n3. INSERT into sessions (like adapter.createSession)…");
  const [session] = await sql`
    INSERT INTO sessions (session_token, user_id, expires)
    VALUES (${`sess-${suffix}`}, ${user.id}, NOW() + interval '30 days')
    RETURNING session_token
  `;
  console.log("   ✅", session);

  console.log("\n4. SELECT from users (like adapter.getUser)…");
  const fetched = await sql`SELECT id, email FROM users WHERE id = ${user.id}`;
  console.log("   ✅", fetched[0]);

  console.log("\n🧹 Cleanup…");
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await sql`DELETE FROM accounts WHERE user_id = ${user.id}`;
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  console.log("   ✅ removed test rows");

  console.log("\n✅ ALL ADAPTER OPERATIONS WORK. The DB is not the problem.");
} catch (err) {
  console.error("\n❌ FAILED:", err.message);
  console.error("   code:", err.code, " detail:", err.detail);
  if (err.message?.includes("row-level security")) {
    console.error("\n⚠️  RLS is still blocking. Run: node scripts/fix-rls-force.mjs");
  }
  process.exit(1);
} finally {
  await sql.end();
}
