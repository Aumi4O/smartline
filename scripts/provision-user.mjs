#!/usr/bin/env node
// Pre-creates a fully activated user/org with test credits so login "just works".
// Usage:  node scripts/provision-user.mjs olga.vasilevsky@gmail.com "Olga Vasilevsky" 1000
//   amount is in cents; default 1000 ($10)
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const email = process.argv[2] || "olga.vasilevsky@gmail.com";
const name = process.argv[3] || "Olga Vasilevsky";
const creditsCents = Number(process.argv[4] || 1000);

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

try {
  console.log(`\nProvisioning ${email} (${name}) with $${(creditsCents / 100).toFixed(2)} in credits…\n`);

  // 1. Upsert user
  const [user] = await sql`
    INSERT INTO users (email, name, email_verified)
    VALUES (${email}, ${name}, NOW())
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, email_verified = NOW()
    RETURNING id, email
  `;
  console.log(`1. users  → ${user.id}  ${user.email}`);

  // 2. Check existing membership; otherwise create org + membership
  const existing = await sql`
    SELECT o.id, o.name, o.slug, o.plan_status
    FROM org_memberships m
    JOIN organizations o ON o.id = m.org_id
    WHERE m.user_id = ${user.id}
    LIMIT 1
  `;

  let org;
  if (existing[0]) {
    org = existing[0];
    console.log(`2. orgs   → already exists: ${org.name} (${org.slug})`);
  } else {
    const slugBase = email.split("@")[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const displayName = slugBase.replace(/[-.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const [created] = await sql`
      INSERT INTO organizations (name, slug, plan, plan_status)
      VALUES (${displayName}, ${slug}, 'starter', 'active')
      RETURNING id, name, slug, plan_status
    `;
    org = created;
    console.log(`2. orgs   → created: ${org.name} (${org.slug})`);

    await sql`
      INSERT INTO org_memberships (user_id, org_id, role)
      VALUES (${user.id}, ${org.id}, 'owner')
    `;
    console.log(`3. memb   → owner`);
  }

  // 3. Activate org (idempotent)
  await sql`UPDATE organizations SET plan_status = 'active', updated_at = NOW() WHERE id = ${org.id}`;
  console.log(`4. status → active`);

  // 4. Credit balance: upsert and top up by creditsCents
  await sql`
    INSERT INTO credit_balances (org_id, balance_cents)
    VALUES (${org.id}, ${creditsCents})
    ON CONFLICT (org_id) DO UPDATE SET balance_cents = credit_balances.balance_cents + ${creditsCents}, updated_at = NOW()
  `;

  // 5. Transaction record
  const [{ balance_cents: newBal }] = await sql`SELECT balance_cents FROM credit_balances WHERE org_id = ${org.id}`;
  await sql`
    INSERT INTO credit_transactions (org_id, type, amount_cents, balance_after, description, metadata)
    VALUES (${org.id}, 'admin_grant', ${creditsCents}, ${newBal}, 'Welcome credit (admin provisioned)', ${sql.json({ reason: "provision-user" })})
  `;
  console.log(`5. credit → $${(newBal / 100).toFixed(2)} total (+$${(creditsCents / 100).toFixed(2)})`);

  console.log(`\n✅ ${email} can log in now. Go to https://smartlineagent.com/login`);
} catch (err) {
  console.error(`\n❌ FAILED: ${err.message}`);
  if (err.detail) console.error(`   detail: ${err.detail}`);
  process.exit(1);
} finally {
  await sql.end();
}
