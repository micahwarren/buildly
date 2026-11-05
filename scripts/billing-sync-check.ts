// Explicit read-only release diagnostic; never issues or modifies credits.
import { reconcilePurchases } from "../lib/billing/reconcile";
if (process.env.SITEAI_BILLING_SYNC_CHECK !== "1")
  throw Error("Operator opt-in required");
const users = JSON.parse(process.env.SITEAI_BILLING_CHECK_USERS || "[]");
if (
  !Array.isArray(users) ||
  users.length !== 2 ||
  users.some((x) => !/^[0-9a-f-]{36}$/i.test(x))
)
  throw Error("Two existing diagnostic account IDs required");
async function check() {
  for (let i = 0; i < users.length; i++) {
    let purchases = 0,
      units = 0;
    await reconcilePurchases(users[i], async (item) => {
      purchases++;
      units += item.credits;
    });
    console.log(
      "Billing verification read-only check:",
      i,
      "owned receipts",
      purchases,
      "units",
      units,
    );
  }
  console.log(
    "Billing provider customer-read verification passed; no balance mutations.",
  );
}
void check().catch(() => {
  console.error("Billing provider verification did not pass.");
  process.exitCode = 1;
});
