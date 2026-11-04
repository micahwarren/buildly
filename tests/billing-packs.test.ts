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
