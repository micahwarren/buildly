const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function purchaseEvent(
  event: Record<string, unknown> | null,
  config: {
    product: string;
    products?: Record<string, number>;
    app?: string;
    sandbox: boolean;
  },
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
  const product = String(event.product_id);
  const credits =
    config.products && Object.hasOwn(config.products, product)
      ? config.products[product]
      : product === config.product
        ? 1
        : 0;
  if (
    event.store !== "APP_STORE" ||
    ![1, 2, 4].includes(credits) ||
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
    credits,
  };
}
