import { DesignError } from "../services/image-design";
/** Delete only the authenticated account's provider profile; never accept a client customer ID. */
export async function deletePurchaseCustomer(
  user: string,
  request: typeof fetch = fetch,
) {
  const key = process.env.REVENUECAT_SECRET_API_KEY,
    project = process.env.REVENUECAT_PROJECT_ID;
  if (!key || !project)
    throw new DesignError(
      "Purchase-profile deletion is unavailable. Please retry or contact support.",
      503,
    );
  const response = await request(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/customers/${encodeURIComponent(user)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 404 || response.status === 204) return;
  if (!response.ok)
    throw new DesignError(
      "Your purchase profile could not be removed. Please retry account deletion.",
      503,
    );
  const value = await response.json();
  if (value.id !== user || !value.deleted_at)
    throw new DesignError(
      "Purchase-profile deletion was not confirmed. Please retry.",
      503,
    );
}
