#!/usr/bin/env node
/**
 * Discovery-only Stripe inspector. Lists:
 *   - Products (active)
 *   - Recurring monthly Prices attached to each
 *   - Promotion Codes (code=TESTER if present)
 *   - The coupon backing TESTER and its applies_to products
 *
 * Read-only. Prints a suggested STRIPE_PRO_PRODUCT_ID / STRIPE_PRO_PRICE_ID.
 */
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set");
  process.exit(1);
}
const stripe = new Stripe(key);

async function main() {
  console.log("\n=== PRODUCTS (active) ===");
  const products = [];
  for await (const p of stripe.products.list({ limit: 100, active: true })) {
    products.push(p);
    console.log(`  ${p.id}  name="${p.name}"  default_price=${p.default_price ?? "-"}`);
  }

  console.log("\n=== MONTHLY RECURRING PRICES ===");
  const monthlyPrices = [];
  for await (const pr of stripe.prices.list({ limit: 100, active: true })) {
    if (pr.recurring?.interval === "month") {
      monthlyPrices.push(pr);
      const productName =
        products.find((p) => p.id === pr.product)?.name ?? "?";
      console.log(
        `  ${pr.id}  $${((pr.unit_amount ?? 0) / 100).toFixed(2)}  product="${productName}"  lookup_key=${pr.lookup_key ?? "-"}  nickname="${pr.nickname ?? ""}"`
      );
    }
  }

  console.log("\n=== PROMO CODE 'TESTER' ===");
  const promos = await stripe.promotionCodes.list({ code: "TESTER", limit: 5 });
  for (const promo of promos.data) {
    const couponRef = promo.promotion?.coupon ?? promo.coupon;
    const couponId =
      typeof couponRef === "string" ? couponRef : couponRef?.id;
    console.log(
      `  ${promo.id}  code=${promo.code}  active=${promo.active}  coupon=${couponId}`
    );
    if (couponId) {
      const coupon = await stripe.coupons.retrieve(couponId, {
        expand: ["applies_to"],
      });
      console.log(
        `    coupon "${coupon.name}"  amount_off=$${((coupon.amount_off ?? 0) / 100).toFixed(2)}  duration=${coupon.duration}`
      );
      const appliesTo = coupon.applies_to?.products ?? [];
      console.log(`    applies_to.products: [${appliesTo.join(", ")}]`);
      for (const pid of appliesTo) {
        const prod = products.find((p) => p.id === pid);
        const prodPrices = monthlyPrices.filter((pr) => pr.product === pid);
        console.log(
          `    → Product ${pid}  name="${prod?.name ?? "?"}"  monthly prices: ${prodPrices.map((p) => `${p.id}($${(p.unit_amount ?? 0) / 100})`).join(", ") || "NONE"}`
        );
      }
    }
  }

  console.log("\n=== SUGGESTION ===");
  const proCandidates = monthlyPrices.filter((p) => p.unit_amount === 19900);
  if (proCandidates.length === 0) {
    console.log("  No active $199/mo recurring price found.");
    console.log("  You need to create one:");
    console.log("    - Product: 'SmartLine Pro'");
    console.log("    - Price:   $199.00 USD, recurring monthly");
    console.log("  Then paste Price ID into Vercel env STRIPE_PRO_PRICE_ID.");
  } else if (proCandidates.length === 1) {
    const p = proCandidates[0];
    const prod = products.find((x) => x.id === p.product);
    console.log(`  STRIPE_PRO_PRODUCT_ID=${p.product}   # "${prod?.name}"`);
    console.log(`  STRIPE_PRO_PRICE_ID=${p.id}`);
    console.log("  Paste these into Vercel env and redeploy.");
  } else {
    console.log("  Multiple $199/mo prices exist:");
    for (const p of proCandidates) {
      const prod = products.find((x) => x.id === p.product);
      console.log(`    price=${p.id}  product=${p.product}  "${prod?.name}"`);
    }
    console.log("  Pick the one tied to your 'SmartLine Pro' product.");
  }
}

main().catch((e) => {
  console.error("Discovery failed:", e.message);
  process.exit(1);
});
