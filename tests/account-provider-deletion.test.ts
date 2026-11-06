import test from "node:test";
import assert from "node:assert/strict";
import { DELETE } from "../app/api/account/route";
test("account removal waits for provider deletion, keeps retry possible and ignores client customer IDs", async () => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REVENUECAT_SECRET_API_KEY",
    "REVENUECAT_PROJECT_ID",
  ];
  const saved = keys.map((k) => process.env[k]),
    oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://delete-fixture.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.REVENUECAT_SECRET_API_KEY = "private-provider";
  process.env.REVENUECAT_PROJECT_ID = "proj_fixture";
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let providerStatus = 503,
    removed = false,
    filesRead = false;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input));
    if (u.hostname === "api.revenuecat.com") {
      assert.ok(u.pathname.endsWith("/" + owner));
      if (init?.method === "GET")
        return new Response(null, {
          status: providerStatus === 200 ? 404 : providerStatus,
        });
      assert.equal(init?.method, "DELETE");
      return providerStatus === 200
        ? Response.json({ id: owner, deleted_at: Date.now() })
        : new Response(null, { status: providerStatus });
    }
    if (u.pathname === "/auth/v1/user")
      return Response.json({
        id: owner,
        email: "test@example.com",
        last_sign_in_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
      });
    if (u.pathname.endsWith("/rpc/buildly_begin_deletion")) {
      assert.equal(JSON.parse(String(init?.body)).p_user, owner);
      return Response.json(null);
    }
    if (u.pathname.includes("/storage/v1/object/list/")) {
      filesRead = true;
      return Response.json([]);
    }
    if (u.pathname === "/auth/v1/admin/users/" + owner) {
      removed = true;
      return Response.json({ id: owner });
    }
    throw Error("Unexpected request");
  };
  try {
    const req = () =>
      new Request("https://siteai.test/api/account", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer user-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerId: "other-account" }),
      });
    assert.equal((await DELETE(req())).status, 503);
    assert.equal(removed, false);
    assert.equal(filesRead, false);
    providerStatus = 200;
    assert.equal((await DELETE(req())).status, 200);
    assert.equal(removed, true);
    assert.equal(filesRead, true);
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((k, i) => {
      if (saved[i] === undefined) delete process.env[k];
      else process.env[k] = saved[i];
    });
  }
});
