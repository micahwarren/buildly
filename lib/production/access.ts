import { imageProviderConfig } from "../image-provider";
import { authenticatedUser } from "../billing/server";
import { DesignError } from "../services/image-design";
export const consentVersion = "2026-10-29";
export async function generationUser(req: Request, consent = false) {
  if (process.env.BUILDLY_GENERATION_ENABLED === "false")
    throw new DesignError(
      "New designs are temporarily paused. Your saved projects are still available.",
      503,
    );
  const account = await authenticatedUser(req);
  if (
    consent &&
    account.user.user_metadata.ai_consent_version !==
      `${consentVersion}:${imageProviderConfig().provider || "unavailable"}`
  )
    throw new DesignError(
      "Please review and accept photo processing in the app before creating a design.",
      403,
    );
  const { data, error } = await account.db
    .from("buildly_account_state")
    .select("deleting_at")
    .eq("user_id", account.user.id)
    .maybeSingle();
  if (error)
    throw new DesignError(
      "The account service needs its production setup. Please contact support.",
      503,
    );
  if (data?.deleting_at)
    throw new DesignError(
      "Your account deletion is in progress. Retry deletion in Settings.",
      409,
    );
  return account;
}
export function requireRecentLogin(user: { last_sign_in_at?: string }) {
  const time = Date.parse(user.last_sign_in_at || "");
  if (
    !Number.isFinite(time) ||
    time > Date.now() + 60000 ||
    Date.now() - time > 5 * 60000
  )
    throw new DesignError(
      "Please confirm your password again before deleting your account.",
      401,
    );
}
