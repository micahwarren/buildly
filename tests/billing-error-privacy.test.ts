import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/billing/sync/route";

test("unexpected purchase-provider failures cannot expose internal response details to the app", async () => {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BILLING_ENABLED",
    "REVENUECAT_SECRET_API_KEY",
    "REVENUECAT_PROJECT_ID",
    "REVENUECAT_APP_ID",
  ];
  const before = names.map((n) => process.env[n]),
    oldFetch = globalThis.fetch;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://privacy-fixture.test",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
    BILLING_ENABLED: "true",
    REVENUECAT_SECRET_API_KEY: "fixture-private",
    REVENUECAT_PROJECT_ID: "projff09f31d",
    REVENUECAT_APP_ID: "app0e2b28467b",
  });
  const detail = "UNEXPECTED_PRIVATE_PROVIDER_RESPONSE";
  globalThis.fetch = async (input) => {
    const u = new URL(String(input));
    if (u.pathname === "/auth/v1/user")
      return Response.json({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        app_metadata: {},
        user_metadata: {},
      });
    if (u.pathname === "/rest/v1/buildly_receipts") return Response.json([]);
    if (u.hostname === "api.revenuecat.com") throw Error(detail);
    throw Error("Unexpected fixture path");
  };
  try {
    const response = await POST(
      new Request("https://siteai.test/api/billing/sync", {
        method: "POST",
        headers: { Authorization: "Bearer fixture" },
        body: "{}",
      }),
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.equal(body.error, "Purchase verification could not finish.");
    assert.equal(JSON.stringify(body).includes(detail), false);
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((n, i) => {
      if (before[i] === undefined) delete process.env[n];
      else process.env[n] = before[i];
    });
  }
});
