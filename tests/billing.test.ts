import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { reservePurchase } from "../lib/billing/server";
import { purchaseEvent } from "../lib/billing/events";

test("only the configured Apple consumable and environment create credits; only actual refunds revoke them", () => {
  const config = {
    product: "sightsaw.project.single",
    app: "app_sightsaw",
    sandbox: false,
  };
  const event = {
    type: "NON_RENEWING_PURCHASE",
    app_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    transaction_id: "100000001",
    product_id: config.product,
    app_id: config.app,
    store: "APP_STORE",
    environment: "PRODUCTION",
  };
  assert.deepEqual(purchaseEvent(event, config), {
    user: event.app_user_id,
    transaction: "PRODUCTION:100000001",
    refund: false,
    credits: 1,
  });
  for (const changes of [
    { product_id: "other" },
    { store: "PLAY_STORE" },
    { app_id: "other" },
    { environment: "SANDBOX" },
    { type: "RENEWAL" },
    { type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" },
  ])
    assert.equal(purchaseEvent({ ...event, ...changes }, config), null);
  assert.equal(
    purchaseEvent(
      { ...event, type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" },
      config,
    )?.refund,
    true,
  );
  assert.equal(
    purchaseEvent(
      { ...event, environment: "SANDBOX" },
      { ...config, sandbox: true },
    )?.transaction,
    "SANDBOX:100000001",
  );
  assert.throws(
    () => purchaseEvent({ ...event, app_user_id: "-".repeat(36) }, config),
    /identity/,
  );
});

test("saved beta projects retain plan recovery without credits; new projects and paid allowances remain protected", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table public.projects(id text primary key,user_id uuid,payload jsonb,created_at timestamptz,deleted_at timestamptz);",
    );
    await db.exec(
      await readFile(
        new URL("../supabase/billing.sql", import.meta.url),
        "utf8",
      ),
    );
    const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.query("insert into auth.users values($1)", [user]);
    await db.query(
      "insert into projects values('old',$1,'{}','2026-11-01',null),('new',$1,'{}','2026-11-05',null),('paid',$1,'{}','2026-11-01',null),('deleted',$1,'{}','2026-11-01','2026-11-02')",
      [user],
    );
    await db.query(
      "insert into buildly_project_access values('paid',$1,'paid',1,null)",
      [user],
    );
    const migration = await readFile(
      new URL("../supabase/billing-beta-access.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    assert.equal(
      (await db.query("select * from buildly_credits")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from buildly_receipts")).rows.length,
      0,
    );
    assert.deepEqual(
      (
        await db.query(
          "select id,revisions from buildly_project_access order by id",
        )
      ).rows,
      [
        { id: "old", revisions: 3 },
        { id: "paid", revisions: 1 },
      ],
    );
    const reservation = (
      await db.query<{ id: string }>(
        "select buildly_reserve($1,'old','plan') as id",
        [user],
      )
    ).rows[0].id;
    await db.query("select buildly_finish($1,$2,true,'old')", [
      user,
      reservation,
    ]);
    assert.equal(
      (
        await db.query<{ revisions: number }>(
          "select revisions from buildly_project_access where id='old'",
        )
      ).rows[0].revisions,
      3,
    );
    await assert.rejects(
      db.query("select buildly_reserve($1,'new','design')", [user]),
      /PAYMENT_REQUIRED/,
    );
  } finally {
    await db.close();
  }
});

test("durable image checkpoints do not regain credits on stale cleanup, and refunded spent purchases cannot fund more revisions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table public.projects(id text primary key,user_id uuid);",
    );
    const sql = await readFile(
      new URL("../supabase/billing.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const root = "11111111-1111-4111-8111-111111111111";
    const revision = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users values($1)", [user]);
    await db.query("select buildly_purchase($1,'purchase-1',false)", [user]);
    let reservation = (
      await db.query<{ id: string }>(
        "select buildly_reserve_job($1,$2,'design',$3::uuid) as id",
        [user, root, root],
      )
    ).rows[0].id;
    await db.query("insert into projects values($1,$2)", [root, user]);
    await db.query(
      "update buildly_reservations set created_at=now()-interval '11 minutes' where id=$1",
      [reservation],
    );
    reservation = (
      await db.query<{ id: string }>(
        "select buildly_reserve($1,$2,'plan') as id",
        [user, root],
      )
    ).rows[0].id;
    await db.query("select buildly_finish($1,$2,true,null)", [
      user,
      reservation,
    ]);
    assert.equal(
      (
        await db.query<{ balance: number }>(
          "select balance from buildly_credits",
        )
      ).rows[0].balance,
      0,
    );
    reservation = (
      await db.query<{ id: string }>(
        "select buildly_reserve_job($1,$2,'design',$3::uuid) as id",
        [user, root, revision],
      )
    ).rows[0].id;
    await db.query("insert into projects values($1,$2)", [revision, user]);
    await db.query(
      "update buildly_reservations set created_at=now()-interval '11 minutes' where id=$1",
      [reservation],
    );
    reservation = (
      await db.query<{ id: string }>(
        "select buildly_reserve($1,$2,'plan') as id",
        [user, revision],
      )
    ).rows[0].id;
    await db.query("select buildly_finish($1,$2,true,null)", [
      user,
      reservation,
    ]);
    assert.equal(
      (
        await db.query<{ revisions: number }>(
          "select revisions from buildly_project_access where id=$1",
          [root],
        )
      ).rows[0].revisions,
      2,
    );
    await db.query("select buildly_purchase($1,'purchase-2',false)", [user]);
    await db.query("select buildly_purchase($1,'purchase-1',true)", [user]);
    assert.equal(
      (
        await db.query<{ balance: number }>(
          "select balance from buildly_credits",
        )
      ).rows[0].balance,
      1,
      "Refunding a spent credit must not remove an unrelated unused credit",
    );
    await assert.rejects(
      db.query("select buildly_reserve($1,$2,'design')", [user, revision]),
      /PROJECT_REFUNDED/,
    );
    assert.equal(
      (await db.query("select * from projects")).rows.length,
      2,
      "Saved designs remain readable",
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select has_function_privilege('authenticated','buildly_reserve_job(uuid,text,text,uuid)','EXECUTE') as ok",
        )
      ).rows[0].ok,
      false,
    );
  } finally {
    await db.close();
  }
});

test("purchases stay unavailable until billing is explicitly enabled", async () => {
  const { GET } = await import("../app/api/billing/status/route");
  const old = process.env.BILLING_ENABLED;
  process.env.BILLING_ENABLED = "false";
  try {
    const response = await GET(new Request("https://buildly.test"));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /not available yet/);
  } finally {
    if (old === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = old;
  }
});

test("unpaid live API calls require a verified login when billing is enabled", async () => {
  const old = process.env.BILLING_ENABLED;
  process.env.BILLING_ENABLED = "true";
  try {
    await assert.rejects(
      reservePurchase(
        new Request("https://buildly.test"),
        "design",
        "project-1",
      ),
      /Sign in/,
    );
  } finally {
    if (old === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = old;
  }
});
test("credits, revision allowances, refunds and duplicate purchase delivery are atomic", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);",
    );
    await db.exec(
      await readFile(
        new URL("../supabase/billing.sql", import.meta.url),
        "utf8",
      ),
    );
    const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await db.query("insert into auth.users values($1),($2)", [user, other]);
    const purchase = (transaction: string, refund = false) =>
      db.query("select buildly_purchase($1,$2,$3)", [
        user,
        transaction,
        refund,
      ]);
    const reserve = async (id: string, kind = "design", uid = user) =>
      (
        await db.query<{ id: string }>(
          "select buildly_reserve($1,$2,$3) as id",
          [uid, id, kind],
        )
      ).rows[0].id;
    const finish = (id: string, success = true, result: string | null = null) =>
      db.query("select buildly_finish($1,$2,$3,$4)", [
        user,
        id,
        success,
        result,
      ]);
    const balance = async () =>
      (
        await db.query<{ balance: number }>(
          "select balance from buildly_credits where user_id=$1",
          [user],
        )
      ).rows[0].balance;
    await assert.rejects(reserve("first"), /PAYMENT_REQUIRED/);
    await purchase("apple-1");
    await purchase("apple-1");
    assert.equal(await balance(), 1);
    let claim = await reserve("first");
    assert.equal(await balance(), 0);
    await assert.rejects(reserve("second"), /REQUEST_IN_PROGRESS/);
    await finish(claim, false);
    await finish(claim, false);
    assert.equal(await balance(), 1);
    claim = await reserve("first");
    await finish(claim);
    assert.equal(await balance(), 0);
    for (let i = 0; i < 3; i++) {
      claim = await reserve(i ? "revision-" + i : "first");
      await finish(claim, true, "revision-" + (i + 1));
    }
    await assert.rejects(reserve("revision-3"), /REVISIONS_USED/);
    claim = await reserve("revision-3", "plan");
    await finish(claim); // retries never spend a revision
    await assert.rejects(reserve("first", "plan", other), /PROJECT_OWNER/);
    await purchase("apple-2");
    await purchase("apple-2", true);
    await purchase("apple-2", true);
    assert.equal(await balance(), 0);
    await purchase("refund-before-delivery", true);
    await purchase("refund-before-delivery");
    assert.equal(await balance(), 0);
    await purchase("apple-3");
    claim = await reserve("stale");
    await db.query(
      "update buildly_reservations set created_at=now()-interval '11 minutes' where id=$1",
      [claim],
    );
    claim = await reserve("replacement");
    await finish(claim, false);
    assert.equal(await balance(), 1);
    const permissions = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','buildly_purchase(uuid,text,boolean)','EXECUTE') as allowed",
    );
    assert.equal(permissions.rows[0].allowed, false);
  } finally {
    await db.close();
  }
});

test("RevenueCat endpoint rejects forged notifications and ignores unrelated products", async () => {
  const { POST } = await import("../app/api/billing/webhook/route");
  const old = process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.REVENUECAT_WEBHOOK_SECRET = "test-secret";
  try {
    assert.equal(
      (
        await POST(
          new Request("https://buildly.test", { method: "POST", body: "{}" }),
        )
      ).status,
      401,
    );
    const response = await POST(
      new Request("https://buildly.test", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
        body: JSON.stringify({
          event: {
            type: "NON_RENEWING_PURCHASE",
            product_id: "unknown",
            environment: "PRODUCTION",
            store: "APP_STORE",
          },
        }),
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ignored: true });
  } finally {
    if (old === undefined) delete process.env.REVENUECAT_WEBHOOK_SECRET;
    else process.env.REVENUECAT_WEBHOOK_SECRET = old;
  }
});

test("verified webhook delivery records only the authenticated account's receipt and retries database failures", async () => {
  const { POST } = await import("../app/api/billing/webhook/route");
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REVENUECAT_WEBHOOK_SECRET",
    "REVENUECAT_PROJECT_PRODUCT_ID",
    "REVENUECAT_APP_ID",
    "BILLING_ALLOW_SANDBOX",
  ];
  const before = Object.fromEntries(
    names.map((key) => [key, process.env[key]]),
  );
  const original = globalThis.fetch;
  const calls: { url: string; body: unknown }[] = [];
  let deleted = false,
    fail = false;
  const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://billing-fixture.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
    REVENUECAT_WEBHOOK_SECRET: "fixture-webhook",
    REVENUECAT_PROJECT_PRODUCT_ID: "sightsaw.project.single",
    REVENUECAT_APP_ID: "app_sightsaw",
    BILLING_ALLOW_SANDBOX: "false",
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.includes("/auth/v1/admin/users/"))
      return Response.json(
        deleted
          ? { message: "User not found", code: "user_not_found" }
          : { user: { id: user, email: "owner@example.com" } },
        { status: deleted ? 404 : 200 },
      );
    if (url.endsWith("/rest/v1/rpc/buildly_purchase_pack"))
      return Response.json(
        fail
          ? { message: "Fixture database unavailable", code: "fixture_failure" }
          : null,
        { status: fail ? 503 : 200 },
      );
    throw Error("Unexpected fixture request");
  };
  const event = {
    type: "NON_RENEWING_PURCHASE",
    app_user_id: user,
    transaction_id: "apple-123",
    product_id: "sightsaw.project.single",
    app_id: "app_sightsaw",
    store: "APP_STORE",
    environment: "PRODUCTION",
  };
  const request = () =>
    new Request("https://sightsaw.test/api/billing/webhook", {
      method: "POST",
      headers: { authorization: "Bearer fixture-webhook" },
      body: JSON.stringify({ event }),
    });
  try {
    assert.equal((await POST(request())).status, 200);
    assert.deepEqual(calls.find((x) => x.url.includes("/rpc/"))?.body, {
      p_user: user,
      p_transaction: "PRODUCTION:apple-123",
      p_units: 1,
      p_refund: false,
    });
    fail = true;
    assert.equal((await POST(request())).status, 503);
    calls.length = 0;
    deleted = true;
    assert.equal((await POST(request())).status, 200);
    assert.equal(
      calls.some((x) => x.url.includes("/rpc/")),
      false,
      "Deleted accounts cannot receive credits from a late receipt",
    );
  } finally {
    globalThis.fetch = original;
    for (const key of names) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});
