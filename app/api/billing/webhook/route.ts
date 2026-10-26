import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/billing/server";
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
    const event = JSON.parse(raw).event;
    if (
      !event ||
      !["NON_RENEWING_PURCHASE", "CANCELLATION"].includes(event.type)
    )
      return Response.json({ ignored: true });
    if (
      event.environment === "SANDBOX" &&
      process.env.BILLING_ALLOW_SANDBOX !== "true"
    )
      return Response.json({ ignored: true });
    if (
      !["SANDBOX", "PRODUCTION"].includes(event.environment) ||
      event.store !== "APP_STORE" ||
      !process.env.REVENUECAT_PROJECT_PRODUCT_ID ||
      event.product_id !== process.env.REVENUECAT_PROJECT_PRODUCT_ID
    )
      return Response.json({ ignored: true });
    if (
      typeof event.app_user_id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(event.app_user_id) ||
      typeof event.transaction_id !== "string"
    )
      return new Response("Invalid purchase identity", { status: 400 });
    const { error } = await adminClient().rpc("buildly_purchase", {
      p_user: event.app_user_id,
      p_transaction: `${event.environment}:${event.transaction_id}`,
      p_refund: event.type === "CANCELLATION",
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
