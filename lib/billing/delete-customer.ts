import { DesignError } from "../services/image-design";
/** RevenueCat queues v2 deletion. Confirm 404 on the same authenticated owner
 * URL; a 200 deletion receipt is not proof that the customer is gone yet. */
export async function deletePurchaseCustomer(
  user: string,
  request: typeof fetch = fetch,
  options: { pause?: (ms: number) => Promise<void> } = {},
) {
  const key = process.env.REVENUECAT_SECRET_API_KEY,
    project = process.env.REVENUECAT_PROJECT_ID;
  if (!key || !project)
    throw new DesignError(
      "Purchase-profile deletion is unavailable. Please retry or contact support.",
      503,
    );
  const url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/customers/${encodeURIComponent(user)}`;
  const deadline = Date.now() + 30000,
    headers = { Authorization: `Bearer ${key}` };
  const response = await request(url, {
    method: "DELETE",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return;
  if (!response.ok)
    throw new DesignError(
      "Your purchase profile could not be removed. Please retry account deletion.",
      503,
    );
  const pause =
    options.pause ||
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < 8 && Date.now() < deadline; attempt++) {
    const checked = await request(url, {
      method: "GET",
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(
        Math.max(1, Math.min(10000, deadline - Date.now())),
      ),
    });
    if (checked.status === 404) return;
    if ([401, 403].includes(checked.status))
      throw new DesignError(
        "Purchase-profile deletion could not be checked. Please retry or contact support.",
        503,
      );
    if (
      checked.status !== 200 &&
      ![409, 423, 429, 500, 502, 503, 504].includes(checked.status)
    )
      break;
    if (attempt < 7) await pause(Math.min(2000, 250 * (attempt + 1)));
  }
  throw new DesignError(
    "Your purchase profile is still being removed. Please try again shortly.",
    503,
  );
}
