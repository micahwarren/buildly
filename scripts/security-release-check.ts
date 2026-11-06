import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

async function main() {
  assert.equal(
    process.env.SITEAI_SECURITY_QA,
    "1",
    "Explicit security QA opt-in required",
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  assert.ok(url && service && publishable, "QA environment is incomplete");
  assert.ok(process.env.CRON_SECRET, "Cron authentication is missing");
  assert.equal(
    process.env.CRON_SECRET,
    process.env.BUILDLY_MAINTENANCE_TOKEN,
    "Vercel Cron and the maintenance route must use the same secret",
  );
  console.info("siteai_security_qa_operations", {
    cronAuthenticationMatches: true,
    billingEnabled: process.env.BILLING_ENABLED === "true",
    sandboxForReview: process.env.BILLING_ALLOW_SANDBOX === "true",
    dailyUserLimit:
      process.env.SIGHTSAW_DAILY_REQUESTS ||
      process.env.BUILDLY_DAILY_REQUESTS ||
      "20",
    dailyServiceLimit:
      process.env.SIGHTSAW_GLOBAL_DAILY_REQUESTS ||
      process.env.BUILDLY_GLOBAL_DAILY_REQUESTS ||
      "50",
  });
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, service, options);
  const users: string[] = [];
  const objects: string[] = [];
  try {
    const clients = [];
    for (let n = 0; n < 2; n++) {
      const password = randomBytes(30).toString("base64url");
      const email = `support+siteai-security-${randomUUID()}@nomappsllc.com`;
      const made = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ok(
        !made.error && made.data.user,
        "Disposable account creation failed",
      );
      users.push(made.data.user.id);
      const client = createClient(url, publishable, options);
      const signed = await client.auth.signInWithPassword({ email, password });
      assert.ok(
        signed.data.session && !signed.error,
        "Disposable sign-in failed",
      );
      clients.push(client);
    }
    const [a] = users,
      [alice, bob] = clients;
    const project = "security-fixture-" + randomUUID();
    const saved = await alice.from("projects").insert({
      id: project,
      user_id: a,
      payload: { title: "Isolated security fixture" },
    });
    assert.equal(saved.error, null, "Owner insert failed");
    assert.equal(
      (await alice.from("projects").select("id").eq("id", project)).data
        ?.length,
      1,
    );
    assert.equal(
      (await bob.from("projects").select("id").eq("id", project)).data?.length,
      0,
      "Another account can read the project",
    );
    const forged = await bob
      .from("projects")
      .insert({ id: "forged-" + project, user_id: a, payload: {} });
    assert.ok(forged.error, "Cross-account project write was permitted");
    const changed = await bob
      .from("projects")
      .update({ payload: { title: "forged" } })
      .eq("user_id", a)
      .eq("id", project)
      .select("id");
    assert.equal(changed.data?.length, 0, "Cross-account update was permitted");
    for (const table of [
      "buildly_credits",
      "buildly_receipts",
      "buildly_project_access",
      "buildly_jobs",
      "buildly_diagnostics",
    ]) {
      const result = await alice.from(table).select("*").limit(1);
      assert.ok(
        result.error || result.data?.length === 0,
        "Protected internal table exposed rows: " + table,
      );
    }
    const rpc = await alice.rpc("buildly_purchase_pack", {
      p_user: a,
      p_transaction: "SECURITY_FIXTURE_MUST_NOT_EXIST",
      p_units: 4,
      p_refund: false,
    });
    assert.ok(rpc.error, "A client can execute the purchase mutation");
    const path = `${a}/${project}/isolation.png`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    );
    const uploaded = await alice.storage
      .from("project-images")
      .upload(path, png, { contentType: "image/png" });
    assert.equal(uploaded.error, null, "Owner photo upload failed");
    objects.push(path);
    assert.equal(
      (await alice.storage.from("project-images").download(path)).error,
      null,
    );
    assert.ok(
      (await bob.storage.from("project-images").download(path)).error,
      "Another account can download a private photo",
    );
    assert.ok(
      (await bob.storage.from("project-images").createSignedUrl(path, 60))
        .error,
      "Another account can sign a private photo",
    );
    assert.ok(
      (
        await bob.storage
          .from("project-images")
          .upload(`${a}/${project}/forged.png`, png, {
            contentType: "image/png",
          })
      ).error,
      "Cross-account photo upload permitted",
    );
    const anon = createClient(url, publishable, options);
    assert.ok(
      (await anon.from("projects").select("id").limit(1)).error,
      "Anonymous project read permitted",
    );
    assert.ok(
      (await anon.storage.from("project-images").download(path)).error,
      "Anonymous photo download permitted",
    );
    console.info(
      "siteai_security_qa",
      JSON.stringify({
        status: "pass",
        accounts: 2,
        ownerReadWrite: true,
        crossAccountReadWriteBlocked: true,
        privatePhotoIsolation: true,
        internalTablesBlocked: true,
        clientCreditMutationBlocked: true,
        customerDataTouched: false,
        purchaseCreditsCreated: 0,
      }),
    );
  } finally {
    if (objects.length) {
      const r = await admin.storage.from("project-images").remove(objects);
      assert.equal(r.error, null, "Fixture files require cleanup");
    }
    for (const id of users) {
      const r = await admin.auth.admin.deleteUser(id);
      assert.equal(r.error, null, "Fixture account requires cleanup");
    }
    console.info("siteai_security_qa_cleanup", {
      accountsRemoved: users.length,
      filesRemoved: objects.length,
    });
  }
}
void main().catch(() => {
  console.error(
    "siteai_security_qa_failed: an isolation or cleanup assertion failed; inspect the gated task before release",
  );
  process.exitCode = 1;
});
