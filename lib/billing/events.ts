const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function purchaseEvent(
  event: Record<string, unknown> | null,
  config: { product: string; app?: string; sandbox: boolean },
) {
  if (
    !event ||
    !["NON_RENEWING_PURCHASE", "CANCELLATION"].includes(String(event.type))
  )
    return null;
  if (
    event.environment !== "PRODUCTION" &&
    !(config.sandbox && event.environment === "SANDBOX")
  )
    return null;
  if (
    event.store !== "APP_STORE" ||
    event.product_id !== config.product ||
    (config.app && event.app_id !== config.app)
  )
    return null;
  if (
    event.type === "CANCELLATION" &&
    event.cancel_reason !== "CUSTOMER_SUPPORT"
  )
    return null;
  if (
    typeof event.app_user_id !== "string" ||
    !uuid.test(event.app_user_id) ||
    typeof event.transaction_id !== "string" ||
    !/^[A-Za-z0-9._:-]{1,200}$/.test(event.transaction_id)
  )
    throw Error("Invalid purchase identity");
  return {
    user: event.app_user_id,
    transaction: `${event.environment}:${event.transaction_id}`,
    refund: event.type === "CANCELLATION",
  };
}
