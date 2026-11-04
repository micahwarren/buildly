import test from "node:test";
import assert from "node:assert/strict";
import { deletePurchaseCustomer } from "../lib/billing/delete-customer";
test("provider deletion is owner-scoped, idempotent, and refuses unconfirmed failures", async () => {
  const oldKey = process.env.REVENUECAT_SECRET_API_KEY,
    oldProject = process.env.REVENUECAT_PROJECT_ID;
  process.env.REVENUECAT_SECRET_API_KEY = "private-fixture";
  process.env.REVENUECAT_PROJECT_ID = "proj_fixture";
  const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  try {
    await deletePurchaseCustomer(user, async (url, init) => {
      assert.equal(
        url,
        `https://api.revenuecat.com/v2/projects/proj_fixture/customers/${user}`,
      );
      assert.equal(init?.method, "DELETE");
      return Response.json({ id: user, deleted_at: Date.now() });
    });
    await deletePurchaseCustomer(
      user,
      async () => new Response(null, { status: 404 }),
    );
    for (const code of [401, 403, 429, 500])
      await assert.rejects(
        deletePurchaseCustomer(
          user,
          async () => new Response(null, { status: code }),
        ),
        /could not be removed/,
      );
    await assert.rejects(
      deletePurchaseCustomer(user, async () =>
        Response.json({ id: "other", deleted_at: 1 }),
      ),
      /not confirmed/,
    );
    delete process.env.REVENUECAT_SECRET_API_KEY;
    await assert.rejects(
      deletePurchaseCustomer(user, async () => {
        throw Error("must not send");
      }),
      /unavailable/,
    );
  } finally {
    if (oldKey === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
    else process.env.REVENUECAT_SECRET_API_KEY = oldKey;
    if (oldProject === undefined) delete process.env.REVENUECAT_PROJECT_ID;
    else process.env.REVENUECAT_PROJECT_ID = oldProject;
  }
});
