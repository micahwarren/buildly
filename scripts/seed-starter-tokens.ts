import assert from "node:assert/strict";
import { adminClient } from "../lib/billing/server";
import { starterIdentity } from "../lib/starter/identity";
import { deviceCheckClient } from "../lib/starter/device-check";
async function main() {
  assert.equal(process.env.SITEAI_SEED_STARTERS, "1");
  // Validate the configured P-256 key locally; no Apple request or device flag is changed.
  deviceCheckClient();
  const key = process.env.STARTER_TOKEN_HASH_KEY;
  assert.ok(key && key.length >= 32, "Starter protection secret is missing");
  const db = adminClient();
  let granted = 0,
    skipped = 0;
  for (let page = 1; page <= 100; page++) {
    const result = await db.auth.admin.listUsers({ page, perPage: 100 });
    assert.equal(
      result.error,
      null,
      "Could not read the existing-account cohort",
    );
    for (const user of result.data.users) {
      const identity = starterIdentity(user, key);
      // All existing accounts receive a launch grant; phone/legacy accounts
      // without an email/provider identity still get one idempotent account grant.
      const hashes = identity.identities.length
        ? identity.identities
        : [identity.account];
      const r = await db.rpc("siteai_starter_seed", {
        p_user: user.id,
        p_account: identity.account,
        p_identities: hashes,
      });
      assert.equal(r.error, null, "A launch grant could not complete");
      if (r.data) granted++;
      else skipped++;
    }
    if (result.data.users.length < 100) {
      console.info("siteai_starter_cohort", {
        granted,
        alreadyGrantedOrNewer: skipped,
        realStorePurchasesCreated: 0,
      });
      return;
    }
  }
  throw Error("Cohort pagination limit reached; inspect before resuming");
}
void main().catch(() => {
  console.error(
    "siteai_starter_cohort_failed: grants are idempotent; inspect the gated task before resuming",
  );
  process.exitCode = 1;
});
