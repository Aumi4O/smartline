#!/usr/bin/env node
/**
 * Rescopes the TESTER promo code to only discount the SmartLine Pro $199/mo line.
 *
 * Why: Stripe does not allow editing `applies_to` on an existing Coupon.
 * So we create a new coupon scoped to the Pro product, then point a fresh
 * TESTER promo code at it (deactivating the old one).
 *
 * Idempotent: re-running skips if the active TESTER already points at a
 * coupon whose applies_to.products includes the Pro product.
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

const PRO_PRODUCT_ID = "prod_UKmyJdLlvIBct0";
const PROMO_CODE = "TESTER";
const AMOUNT_OFF_CENTS = 15000;

async function isScopedToPro(coupon) {
  const applies = coupon?.applies_to?.products ?? [];
  return applies.includes(PRO_PRODUCT_ID);
}

async function main() {
  const existing = await stripe.promotionCodes.list({
    code: PROMO_CODE,
    limit: 10,
  });

  let needsNew = true;
  for (const promo of existing.data) {
    const couponRef = promo.promotion?.coupon ?? promo.coupon;
    const couponId =
      typeof couponRef === "string" ? couponRef : couponRef?.id;
    if (!couponId) continue;

    const coupon = await stripe.coupons.retrieve(couponId, {
      expand: ["applies_to"],
    });

    if (promo.active && (await isScopedToPro(coupon))) {
      console.log(
        `[=] TESTER already scoped to Pro. promo=${promo.id}  coupon=${couponId}  nothing to do.`
      );
      needsNew = false;
    } else if (promo.active) {
      console.log(
        `[!] TESTER promo ${promo.id} is active but NOT scoped to Pro. Deactivating.`
      );
      await stripe.promotionCodes.update(promo.id, { active: false });
    }
  }

  if (!needsNew) return;

  console.log(
    `[+] Creating new coupon: $${(AMOUNT_OFF_CENTS / 100).toFixed(2)} off once, scoped to ${PRO_PRODUCT_ID}`
  );
  const coupon = await stripe.coupons.create({
    name: "Launch tester — $150 off first month (Pro only)",
    amount_off: AMOUNT_OFF_CENTS,
    currency: "usd",
    duration: "once",
    applies_to: { products: [PRO_PRODUCT_ID] },
    metadata: { slug: "tester_150_off_pro" },
  });
  console.log(
    `[+] Coupon    ${coupon.id}  applies_to.products=${JSON.stringify(coupon.applies_to?.products ?? [])}`
  );

  const promo = await stripe.promotionCodes.create({
    promotion: { coupon: coupon.id, type: "coupon" },
    code: PROMO_CODE,
    active: true,
  });
  console.log(`[+] Promo     ${promo.id}  code=${promo.code}  active=${promo.active}`);

  console.log(
    `\nDone. Customers can now enter ${PROMO_CODE} at checkout for $150 off the first $199 — the $5 activation is never discounted.`
  );
}

main().catch((e) => {
  console.error("Fix failed:", e);
  process.exit(1);
});
