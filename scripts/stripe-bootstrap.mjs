#!/usr/bin/env node
/**
 * Idempotent Stripe bootstrap for SmartLine.
 *
 * Creates / finds:
 *   - Product:       metadata.slug = "smartline_pro"
 *   - Price:         lookup_key    = "smartline_pro_monthly" ($199/mo, recurring)
 *   - Coupon:        metadata.slug = "tester_150_off_pro"  ($150 off once, scoped to Pro product)
 *   - Promo Code:    code          = "TESTER"              (attached to the coupon)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-bootstrap.mjs
 *
 * Safe to re-run: everything is looked up by stable key/metadata first.
 * Prints the three env values to paste into Vercel:
 *   STRIPE_PRO_PRODUCT_ID, STRIPE_PRO_PRICE_ID, and the TESTER promo_code id (FYI).
 */
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set in env. Run with `STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-bootstrap.mjs` or set it in .env.local.");
  process.exit(1);
}

const stripe = new Stripe(key);

const PRODUCT_SLUG = "smartline_pro";
const PRICE_LOOKUP_KEY = "smartline_pro_monthly";
const COUPON_SLUG = "tester_150_off_pro";
const PROMO_CODE = "TESTER";

const PRICE_AMOUNT_CENTS = 19900;
const COUPON_OFF_CENTS = 15000;

async function findProduct() {
  for await (const p of stripe.products.list({ limit: 100, active: true })) {
    if (p.metadata?.slug === PRODUCT_SLUG) return p;
  }
  return null;
}

async function findPrice() {
  const res = await stripe.prices.list({
    lookup_keys: [PRICE_LOOKUP_KEY],
    limit: 1,
    active: true,
  });
  return res.data[0] || null;
}

async function findCoupon() {
  for await (const c of stripe.coupons.list({ limit: 100 })) {
    if (c.metadata?.slug === COUPON_SLUG) return c;
  }
  return null;
}

async function findPromoCode() {
  const res = await stripe.promotionCodes.list({
    code: PROMO_CODE,
    limit: 1,
  });
  return res.data[0] || null;
}

async function main() {
  console.log("Stripe bootstrap — using key", key.slice(0, 12) + "…");

  let product = await findProduct();
  if (product) {
    console.log(`[=] Product       ${product.id}  (${product.name})`);
  } else {
    product = await stripe.products.create({
      name: "SmartLine Pro",
      description: "AI voice agents platform — 3 agents, 10 numbers, 100 KB docs, 5 GB storage, priority support.",
      metadata: { slug: PRODUCT_SLUG },
    });
    console.log(`[+] Product       ${product.id}  (${product.name})`);
  }

  let price = await findPrice();
  if (price && price.product !== product.id) {
    console.log(`[!] Existing price ${price.id} belongs to a different product. Deactivating and creating a new one.`);
    await stripe.prices.update(price.id, { active: false, lookup_key: null });
    price = null;
  }
  if (price) {
    console.log(`[=] Price         ${price.id}  ($${(price.unit_amount / 100).toFixed(2)}/${price.recurring?.interval})`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: PRICE_AMOUNT_CENTS,
      recurring: { interval: "month" },
      lookup_key: PRICE_LOOKUP_KEY,
      nickname: "SmartLine Pro — Monthly $199",
      transfer_lookup_key: true,
    });
    console.log(`[+] Price         ${price.id}  ($${(price.unit_amount / 100).toFixed(2)}/mo)`);
  }

  let coupon = await findCoupon();
  if (coupon) {
    console.log(`[=] Coupon        ${coupon.id}  ($${(coupon.amount_off / 100).toFixed(2)} off ${coupon.duration})`);
  } else {
    coupon = await stripe.coupons.create({
      name: "Launch tester — $150 off first month",
      amount_off: COUPON_OFF_CENTS,
      currency: "usd",
      duration: "once",
      applies_to: { products: [product.id] },
      metadata: { slug: COUPON_SLUG },
    });
    console.log(`[+] Coupon        ${coupon.id}  ($${(coupon.amount_off / 100).toFixed(2)} off once, Pro only)`);
  }

  let promo = await findPromoCode();
  if (promo && promo.coupon.id !== coupon.id) {
    console.log(`[!] Existing TESTER promo ${promo.id} points at a different coupon; deactivating.`);
    await stripe.promotionCodes.update(promo.id, { active: false });
    promo = null;
  }
  if (promo) {
    console.log(`[=] Promo code    ${promo.id}  code=${promo.code}  active=${promo.active}`);
    if (!promo.active) {
      await stripe.promotionCodes.update(promo.id, { active: true });
      console.log(`[~] Promo code    ${promo.id}  re-activated`);
    }
  } else {
    promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: PROMO_CODE,
      active: true,
    });
    console.log(`[+] Promo code    ${promo.id}  code=${promo.code}`);
  }

  console.log("\nPaste these into Vercel env (and .env.local):\n");
  console.log(`STRIPE_PRO_PRODUCT_ID=${product.id}`);
  console.log(`STRIPE_PRO_PRICE_ID=${price.id}`);
  console.log(`\nPromo code FYI (customers enter at Checkout): ${PROMO_CODE}  →  coupon ${coupon.id}`);
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
