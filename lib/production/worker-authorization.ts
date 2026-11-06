import { createHmac, timingSafeEqual } from "node:crypto";

// Short-lived signatures, bound to a one-use nonce, keep the permanent worker
// credential out of pg_net's platform-managed transport tables.
export function workerAuthorization(
  headers: Headers,
  secret: string | undefined,
  now = Date.now(),
) {
  const sent = headers.get("x-siteai-time") || "";
  const nonce = headers.get("x-siteai-nonce") || "";
  const signature = headers.get("x-siteai-signature") || "";
  if (!secret || !/^\d{10}$/.test(sent) ||
      Math.abs(now - Number(sent) * 1000) > 120_000 ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(nonce) ||
      !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = createHmac("sha256", secret).update(sent + "." + nonce).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected)
    ? { nonce, sent: Number(sent) }
    : null;
}
