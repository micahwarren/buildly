import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { reservePurchase } from "../lib/billing/server";

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
