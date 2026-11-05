import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePurchases } from "../lib/billing/reconcile";
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const envs = [
  "REVENUECAT_SECRET_API_KEY",
  "REVENUECAT_PROJECT_ID",
  "REVENUECAT_APP_ID",
  "BILLING_ALLOW_SANDBOX",
];
function setup() {
  const old = Object.fromEntries(envs.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    REVENUECAT_SECRET_API_KEY: "fixture-secret",
    REVENUECAT_PROJECT_ID: "projff09f31d",
    REVENUECAT_APP_ID: "app0e2b28467b",
    BILLING_ALLOW_SANDBOX: "true",
  });
  return () => {
    for (const k of envs)
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
  };
}
const purchase = {
  customer_id: user,
  product_id: "prod6fd19e2ebf",
  store_purchase_identifier: "20000001",
  environment: "sandbox",
  store: "app_store",
  status: "owned",
  ownership: "purchased",
  quantity: 1,
};
test("only provider-verified owned Apple receipts for the signed-in customer grant the configured pack", async () => {
  const cleanup = setup();
  const applied: unknown[] = [];
  try {
    const invalid = [
      { customer_id: other },
      { store: "play_store" },
      { status: "refunded" },
      { ownership: "family_shared" },
      { quantity: 4 },
      { product_id: "unrelated" },
      { environment: "unknown" },
      { store_purchase_identifier: "forged /receipt" },
    ].map((p) => ({ ...purchase, ...p }));
    await reconcilePurchases(
      user,
      async (r) => {
        applied.push(r);
      },
      async (url, init) => {
        assert.equal(new URL(String(url)).hostname, "api.revenuecat.com");
        assert.equal(
          (init?.headers as Record<string, string>).Authorization,
          "Bearer fixture-secret",
        );
        assert.ok(String(url).includes(user));
        return Response.json({
          items: [
            ...invalid,
            purchase,
            {
              ...purchase,
              product_id: "prode8cc5fe6d1",
              store_purchase_identifier: "20000002",
            },
            {
              ...purchase,
              product_id: "prod4026aedadf",
              store_purchase_identifier: "20000003",
            },
          ],
          next_page: null,
        });
      },
    );
    assert.deepEqual(applied, [
      { transaction: "SANDBOX:20000001", credits: 1 },
      { transaction: "SANDBOX:20000002", credits: 2 },
      { transaction: "SANDBOX:20000003", credits: 4 },
    ]);
    process.env.BILLING_ALLOW_SANDBOX = "false";
    applied.length = 0;
    await reconcilePurchases(
      user,
      async (r) => {
        applied.push(r);
      },
      async () =>
        Response.json({
          items: [purchase, { ...purchase, environment: "production" }],
          next_page: null,
        }),
    );
    assert.deepEqual(applied, [
      { transaction: "PRODUCTION:20000001", credits: 1 },
    ]);
  } finally {
    cleanup();
  }
});
test("pagination cannot send the private key to another host or another customer's endpoint", async () => {
  const cleanup = setup();
  try {
    for (const next_page of [
      "https://attacker.invalid/steal",
      "https://api.revenuecat.com/v2/projects/projff09f31d/customers/other/purchases",
    ]) {
      let calls = 0;
      await assert.rejects(
        reconcilePurchases(
          user,
          async () => {},
          async () => {
            calls++;
            return Response.json({ items: [purchase], next_page });
          },
        ),
        /could not finish/,
      );
      assert.equal(calls, 1);
    }
    let pages = 0;
    await reconcilePurchases(
      user,
      async () => {},
      async () =>
        Response.json({
          items: pages++ === 0 ? [purchase] : [],
          next_page:
            pages === 1
              ? `https://api.revenuecat.com/v2/projects/projff09f31d/customers/${user}/purchases?starting_after=next`
              : null,
        }),
    );
    assert.equal(pages, 2);
  } finally {
    cleanup();
  }
});
test("provider failure and missing customer never fabricate credits", async () => {
  const cleanup = setup();
  let applied = false;
  try {
    await assert.rejects(
      reconcilePurchases(
        user,
        async () => {
          applied = true;
        },
        async () => new Response(null, { status: 403 }),
      ),
      /taking longer/,
    );
    await reconcilePurchases(
      user,
      async () => {
        applied = true;
      },
      async () => new Response(null, { status: 404 }),
    );
    assert.equal(applied, false);
  } finally {
    cleanup();
  }
});

test("recovery endpoint ignores forged owners and amounts, supports native transaction aliases, and deduplicates the ledger", async () => {
  const cleanup = setup(),
    originalFetch = globalThis.fetch;
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BILLING_ENABLED",
  ];
  const old = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://billing-fixture.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
    BILLING_ENABLED: "true",
  });
  let recorded = false,
    refunded = false,
    writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.revenuecat.com") {
      assert.ok(url.pathname.includes(user));
      return Response.json({
        items: [
          { ...purchase, id: "rc_pch_sdk", product_id: "prode8cc5fe6d1" },
        ],
        next_page: null,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return Response.json({ id: user, email: "fixture@example.invalid" });
    if (url.pathname.endsWith("/rpc/buildly_purchase_pack")) {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        p_user: user,
        p_transaction: "SANDBOX:20000001",
        p_units: 2,
        p_refund: false,
      });
      writes++;
      recorded = true;
      return Response.json(null);
    }
    if (url.pathname.endsWith("/buildly_credits"))
      return Response.json([{ balance: recorded ? 2 : 0 }]);
    if (url.pathname.endsWith("/buildly_receipts")) {
      assert.equal(url.searchParams.get("user_id"), "eq." + user);
      if (init?.method === "HEAD")
        return new Response(null, {
          headers: { "Content-Range": `0-0/${recorded ? 1 : 0}` },
        });
      const proof = url.searchParams.has("refunded");
      return Response.json(
        recorded && (!proof || !refunded)
          ? [{ transaction_id: "SANDBOX:20000001" }]
          : [],
      );
    }
    throw Error("Unexpected billing fixture request");
  };
  try {
    const { POST } = await import("../app/api/billing/sync/route");
    const req = () =>
      new Request("https://siteai.test/api/billing/sync", {
        method: "POST",
        headers: { authorization: "Bearer fixture-session" },
        body: JSON.stringify({
          transaction: "rc_pch_sdk",
          user: other,
          credits: 1000,
        }),
      });
    let result = await POST(req());
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), {
      credits: 2,
      receiptCount: 1,
      verified: true,
    });
    assert.equal(writes, 1);
    result = await POST(req());
    assert.equal(result.status, 200);
    assert.equal(writes, 1, "Existing server receipts are never reissued");
    refunded = true;
    result = await POST(req());
    assert.equal(
      (await result.json()).verified,
      false,
      "A refunded ledger receipt cannot complete checkout",
    );
    const bad = await POST(
      new Request("https://siteai.test/api/billing/sync", {
        method: "POST",
        headers: { authorization: "Bearer fixture-session" },
        body: "{",
      }),
    );
    assert.equal(bad.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    for (const k of names)
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
  }
});
