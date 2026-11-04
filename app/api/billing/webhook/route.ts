import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/billing/server";
import { purchaseEvent } from "@/lib/billing/events";
import { projectProducts } from "@/lib/billing/products";
export async function POST(req: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const raw = await req.text();
    if (raw.length > 100000) return new Response("Too large", { status: 413 });
    let event;
    try {
      event = purchaseEvent(JSON.parse(raw).event, {
        product:
          process.env.REVENUECAT_PROJECT_PRODUCT_ID ||
          "sightsaw.project.single",
        products: Object.fromEntries(
          projectProducts(process.env.REVENUECAT_PROJECT_PRODUCT_ID).map(
            (p) => [p.productId, p.credits],
          ),
        ),
        app: process.env.REVENUECAT_APP_ID,
        sandbox: process.env.BILLING_ALLOW_SANDBOX === "true",
      });
    } catch {
      return new Response("Invalid purchase identity", { status: 400 });
    }
    if (!event) return Response.json({ ignored: true });
    const db = adminClient();
    const account = await db.auth.admin.getUserById(event.user);
    if (account.error && account.error.status !== 404)
      return new Response("Account check unavailable; retry delivery", {
        status: 503,
      });
    if (!account.data.user) return Response.json({ ignored: true });
    const { error } = await db.rpc("buildly_purchase_pack", {
      p_user: event.user,
      p_transaction: event.transaction,
      p_refund: event.refund,
      p_units: event.credits,
    });
    if (error)
      return new Response("Purchase not recorded; retry delivery", {
        status: 503,
      });
    return Response.json({ received: true });
  } catch {
    return new Response("Unable to process event", { status: 500 });
  }
}
