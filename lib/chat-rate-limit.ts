import { DesignError } from "./services/image-design";
const requests = new Map<string, { count: number; expires: number }>();
export function checkChatLimit(req: Request) {
  const now = Date.now();
  for (const [key, value] of requests)
    if (value.expires < now) requests.delete(key);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const record = requests.get(ip) || {
    count: 0,
    expires: now + 15 * 60 * 1000,
  };
  if (record.count >= 20 || (!requests.has(ip) && requests.size >= 10000))
    throw new DesignError(
      "You have asked several questions. Please wait a few minutes before asking more.",
      429,
    );
  record.count++;
  requests.set(ip, record);
}
