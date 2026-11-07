import { randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DesignError } from "../services/image-design";
import { starterIdentity } from "./identity";
import { deviceCheckClient, starterConfigured } from "./device-check";
import { hasAdultEligibility } from "../eligibility";

export async function claimStarter(
  db: SupabaseClient,
  user: User,
  deviceToken: string,
  checker = deviceCheckClient(),
) {
  if (!hasAdultEligibility(user.user_metadata))
    throw new DesignError("Confirm you are 18 or older in the latest Site AI app before claiming a starter token.", 403, "adult_eligibility_required");
  if (!starterConfigured())
    throw new DesignError(
      "Starter tokens are not ready yet. Please try again shortly.",
      503,
    );
  if (!user.email_confirmed_at && !user.phone_confirmed_at)
    throw new DesignError(
      "Confirm your account before claiming a starter token.",
      403,
    );
  const identity = starterIdentity(user, process.env.STARTER_TOKEN_HASH_KEY!);
  if (!identity.identities.length)
    throw new DesignError("A verified sign-in is required.", 403);
  const lease = randomUUID();
  let acquired = false;
  const rpc = async (name: string, values: object) => {
    const result = await db.rpc(name, values);
    if (result.error)
      throw new DesignError(
        "Your starter token check could not finish. Please try again shortly.",
        503,
      );
    return result.data;
  };
  try {
    const start = await rpc("siteai_starter_begin", {
      p_user: user.id,
      p_account: identity.account,
      p_identities: identity.identities,
      p_lease: lease,
    });
    acquired = start.lease === true;
    if (start.state === "busy")
      throw new DesignError(
        "Another starter check is finishing. Try again in a moment.",
        429,
      );
    if (start.state === "limited")
      throw new DesignError(
        "Your starter check needs a little time. Please try again tomorrow or contact support.",
        429,
      );
    if (start.state === "used") return { status: "used" as const };
    if (start.state === "granted" && !acquired)
      return { status: "granted" as const, added: false };
    if (!acquired || typeof start.id !== "string")
      throw new DesignError("Starter verification is unavailable.", 503);
    if (start.state !== "verified") {
      const used = await checker.used(deviceToken);
      if (used && start.state !== "granted") return { status: "used" as const };
      await checker.markUsed(deviceToken);
      // Only a successful, authenticated Apple update can reach this private RPC.
      await rpc("siteai_starter_verify", {
        p_user: user.id,
        p_claim: start.id,
        p_lease: lease,
      });
    }
    await rpc("siteai_starter_complete", {
      p_user: user.id,
      p_claim: start.id,
      p_lease: lease,
    });
    return { status: "granted" as const, added: start.state !== "granted" };
  } finally {
    if (acquired) await db.rpc("siteai_starter_release", { p_lease: lease });
  }
}
