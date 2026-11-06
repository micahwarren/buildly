import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { purchaseEvent } from "../lib/billing/events";
import { projectProducts } from "../lib/billing/products";

const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("only the configured SKU determines the 1/2/4 pack grant, never a client-provided quantity", () => {
  const products = Object.fromEntries(
    projectProducts().map((p) => [p.productId, p.credits]),
  );
  for (const pack of projectProducts()) {
    const result = purchaseEvent(
      {
        type: "NON_RENEWING_PURCHASE",
        environment: "SANDBOX",
        store: "APP_STORE",
        app_id: "app_test",
        app_user_id: user,
        transaction_id: "apple-123",
        product_id: pack.productId,
        credits: 1000,
      },
      {
        product: "sightsaw.project.single",
        products,
        app: "app_test",
        sandbox: true,
      },
    );
    assert.equal(result?.credits, pack.credits);
  }
});
test("packs stack, allocate individual tokens, survive retries, and refunds preserve unrelated tokens", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);",
    );
    const sql = await readFile(
      new URL("../supabase/billing.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.query("insert into auth.users values($1)", [user]);
    const purchase = (id: string, count: number, refund = false) =>
      db.query("select buildly_purchase_pack($1,$2,$3,$4)", [
        user,
        id,
        count,
        refund,
      ]);
    const balance = async () =>
      (
        await db.query<{ balance: number }>(
          "select balance from buildly_credits",
        )
      ).rows[0].balance;
    const reserve = async (project: string) =>
      (
        await db.query<{ id: string }>(
          "select buildly_reserve($1,$2,'design') as id",
          [user, project],
        )
      ).rows[0].id;
    await purchase("four", 4);
    await purchase("four", 4);
    assert.equal(await balance(), 4);
    await db.exec(sql); // Upgrading/reapplying never duplicates unit rows.
    for (const project of ["first", "second"]) {
      const reservation = await reserve(project);
      await db.query("select buildly_finish($1,$2,true,$3)", [
        user,
        reservation,
        project,
      ]);
    }
    assert.deepEqual(
      (
        await db.query(
          "select purchase_unit from buildly_project_access order by purchase_unit",
        )
      ).rows,
      [{ purchase_unit: 1 }, { purchase_unit: 2 }],
    );
    await purchase("two", 2);
    assert.equal(await balance(), 4);
    await purchase("four", 4, true);
    await purchase("four", 4, true);
    assert.equal(
      await balance(),
      2,
      "Only unused units from the refunded pack are removed",
    );
    await assert.rejects(reserve("first"), /PROJECT_REFUNDED/);
    await purchase("refunded-before-delivery", 2, true);
    await purchase("refunded-before-delivery", 2);
    assert.equal(await balance(), 2);
    const failed = await reserve("third");
    assert.equal(await balance(), 1);
    await db.query("select buildly_finish($1,$2,false,null)", [user, failed]);
    assert.equal(
      await balance(),
      2,
      "A failed image restores exactly its reserved unit",
    );
    await purchase("another-two", 2);
    assert.equal(
      await balance(),
      4,
      "Existing tokens never prevent another purchase",
    );
    await assert.rejects(purchase("two", 4), /pack mismatch/);
    await assert.rejects(purchase("invalid", 100), /Invalid pack/);
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select has_function_privilege('authenticated','buildly_purchase_pack(uuid,text,integer,boolean)','EXECUTE') as ok",
        )
      ).rows[0].ok,
      false,
    );
  } finally {
    await db.close();
  }
});

test("receipt binding survives account deletion without retaining readable account/transaction IDs", async () => {
  const db = new PGlite(),
    other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);",
    );
    await db.exec(
      await readFile(
        new URL("../supabase/billing.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values($1),($2)", [user, other]);
    // Backfill a pre-upgrade receipt; do not change its balance.
    await db.query(
      "select buildly_purchase_pack($1,'fixture-before-upgrade',2,false)",
      [user],
    );
    const migration = await readFile(
      new URL("../supabase/receipt-fingerprints.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    await db.query(
      "select buildly_purchase_pack($1,'fixture-before-upgrade',2,false)",
      [user],
    );
    assert.equal(
      (
        await db.query<{ balance: number }>(
          "select balance from buildly_credits where user_id=$1",
          [user],
        )
      ).rows[0].balance,
      2,
    );
    await db.query(
      "select buildly_purchase_pack($1,'fixture-after-upgrade',1,false)",
      [user],
    );
    await db.query("delete from auth.users where id=$1", [user]);
    assert.equal(
      (await db.query("select * from buildly_receipts")).rows.length,
      0,
    );
    for (const receipt of ["fixture-before-upgrade", "fixture-after-upgrade"])
      await assert.rejects(
        db.query("select buildly_purchase_pack($1,$2,1,false)", [
          other,
          receipt,
        ]),
        /RECEIPT_RETIRED/,
      );
    await db.query(
      "select buildly_purchase_pack($1,'genuinely-new-purchase',4,false)",
      [other],
    );
    assert.equal(
      (
        await db.query<{ balance: number }>(
          "select balance from buildly_credits where user_id=$1",
          [other],
        )
      ).rows[0].balance,
      4,
    );
    const columns = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name='siteai_purchase_fingerprints' order by ordinal_position",
    );
    assert.deepEqual(
      columns.rows.map((x) => x.column_name),
      ["transaction_hash", "account_hash"],
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege('authenticated','siteai_purchase_fingerprints','SELECT') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
