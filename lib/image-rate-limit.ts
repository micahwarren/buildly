import { DesignError } from "./services/image-design";
const attempts = new Map<string, { count: number; expires: number }>();
/** Per-instance guard. Use a shared limiter or Vercel Firewall for a global production limit. */
export function checkImageLimit(request: Request, demo: boolean) {
  if (demo || !process.env.OPENAI_API_KEY) return;
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.expires <= now) attempts.delete(key);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  let record = attempts.get(ip);
  if (!record) {
    if (attempts.size >= 10000)
      throw new DesignError(
        "Photo previews are busy. Please try again shortly.",
        429,
      );
    record = { count: 0, expires: now + 15 * 60 * 1000 };
    attempts.set(ip, record);
  }
  if (record.count >= 3)
    throw new DesignError(
      "You have requested several designs. Please wait 15 minutes before trying another.",
      429,
    );
  record.count++;
}
