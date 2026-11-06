import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { enqueueJob, processQueuedJob } from "../lib/production/job-queue";
import {
  notifyReady,
  deliverNotifications,
} from "../lib/production/notifications";
import { backgroundFixture, owner, other, jobId } from "./helpers/background";
const token = "ExpoPushToken[fixture-token-1234567890]",
  deviceHash = createHash("sha256").update(token).digest("hex");
test("acceptance persists the request before returning; worker completes without the original phone request", async () => {
  const f = await backgroundFixture();
  process.env.BILLING_ENABLED = "true";
  const scheduled: string[] = [];
  try {
    const result = await enqueueJob(
      f.request(),
      "design",
      (id) => scheduled.push(id),
      f.dependencies,
    );
    assert.equal(result.state, "running");
    assert.equal(result.background, true);
    assert.equal(f.calls().designs, 0);
    assert.equal(
      (
        await f.pg.query<{ payload_text: string }>(
          "select payload_text from siteai_job_queue",
        )
      ).rows[0].payload_text.includes("simple bench"),
      true,
    );
    await enqueueJob(
      f.request(),
      "design",
      (id) => scheduled.push(id),
      f.dependencies,
    );
    assert.equal(
      (await f.pg.query("select * from siteai_job_queue")).rows.length,
      1,
    );
    // The client is gone: a separate server worker uses only private durable input.
    await Promise.all([
      processQueuedJob(jobId, f.db, f.dependencies),
      processQueuedJob(jobId, f.db, f.dependencies),
    ]);
    assert.equal(f.calls().designs, 1);
    assert.equal(await f.balance(), 1);
    const stored = (
      await f.pg.query<{ state: string; payload_text: string | null }>(
        "select j.state,q.payload_text from buildly_jobs j join siteai_job_queue q on q.job_id=j.id",
      )
    ).rows[0];
    assert.equal(stored.state, "complete");
    assert.equal(stored.payload_text, null);
    assert.equal(
      (
        await f.pg.query<{
          payload: {
            planStatus: string;
            materials: unknown[];
            steps: unknown[];
          };
        }>("select payload from projects")
      ).rows[0].payload.planStatus,
      "design-based",
    );
    await processQueuedJob(jobId, f.db, f.dependencies);
    assert.equal(f.calls().designs, 1);
    assert.equal(await f.balance(), 1);
  } finally {
    await f.pg.close();
    delete process.env.BILLING_ENABLED;
  }
});
test("a terminated worker releases an undelivered reservation and a saved image resumes only its matching plan", async () => {
  const f = await backgroundFixture();
  process.env.BILLING_ENABLED = "true";
  try {
    await enqueueJob(f.request(), "design", () => {}, f.dependencies);
    const oldLease = randomUUID();
    await f.pg.query("select siteai_claim_queued_job($1,$2)", [
      jobId,
      oldLease,
    ]);
    await f.pg.query("select buildly_reserve_job($1,$2,'design',$3)", [
      owner,
      jobId,
      jobId,
    ]);
    assert.equal(await f.balance(), 1);
    await f.pg.exec(
      "update siteai_job_queue set due_at=now()-interval '1 second'",
    );
    await processQueuedJob(jobId, f.db, f.dependencies);
    assert.equal(f.calls().designs, 1);
    assert.equal(
      await f.balance(),
      1,
      "Exactly one token funds the eventual image",
    );
    // Replaying the old worker's completion cannot replace its successor's state.
    await f.pg.query("select siteai_finish_queued_job($1,$2,true)", [
      jobId,
      oldLease,
    ]);
    assert.equal(
      (
        await f.pg.query<{ status: string }>(
          "select status from siteai_job_queue",
        )
      ).rows[0].status,
      "done",
    );
    // A different project checkpoints an image, then the execution is terminated.
    const next = "22222222-2222-4222-8222-222222222222";
    await enqueueJob(f.request(next), "design", () => {}, f.dependencies);
    const lease = randomUUID();
    await f.pg.query("select siteai_claim_queued_job($1,$2)", [next, lease]);
    await f.pg.query("select buildly_reserve_job($1,$2,'design',$3)", [
      owner,
      next,
      next,
    ]);
    const previous = (
      await f.pg.query<{ payload: Record<string, unknown> }>(
        "select payload from projects where id=$1",
        [jobId],
      )
    ).rows[0].payload;
    await f.pg.query(
      "insert into projects(id,user_id,payload)values($1,$2,$3)",
      [next, owner, { ...previous, id: next, planStatus: "unavailable" }],
    );
    await f.pg.query(
      "update buildly_jobs set state='image_saved',result_id=$1 where id=$2",
      [next, next],
    );
    await f.pg.query(
      "update siteai_job_queue set due_at=now()-interval '1 second' where job_id=$1",
      [next],
    );
    await processQueuedJob(next, f.db, f.dependencies);
    assert.equal(f.calls().designs, 1, "The checkpoint is not regenerated");
    assert.equal(f.calls().plans, 1);
    assert.equal(await f.balance(), 0);
    assert.equal(
      (
        await f.pg.query<{ revisions: number }>(
          "select revisions from buildly_project_access where id=$1",
          [next],
        )
      ).rows[0].revisions,
      3,
    );
  } finally {
    await f.pg.close();
    delete process.env.BILLING_ENABLED;
  }
});
test("only complete matching plans queue a notification, sends are deduplicated, and tokens transfer to the active account", async () => {
  const f = await backgroundFixture();
  process.env.BILLING_ENABLED = "true";
  try {
    await f.pg.query("select siteai_register_push($1,$2,$3,'ios')", [
      owner,
      deviceHash,
      token,
    ]);
    await enqueueJob(f.request(), "design", () => {}, f.dependencies);
    await notifyReady(f.db, owner, jobId, jobId);
    assert.equal(
      (await f.pg.query("select * from siteai_push_outbox")).rows.length,
      0,
      "No premature picture-only notification",
    );
    // Disable the automatic network sender for this fixture by temporarily disabling its device.
    await f.pg.exec("update siteai_push_devices set enabled=false");
    await processQueuedJob(jobId, f.db, f.dependencies);
    await f.pg.exec(
      "update siteai_push_devices set enabled=true;update siteai_job_queue set notification_checked=false",
    );
    await Promise.all([
      notifyReady(f.db, owner, jobId, jobId),
      notifyReady(f.db, owner, jobId, jobId),
    ]);
    let sends = 0;
    const provider = (async (url: unknown, options: RequestInit) => {
      sends++;
      assert.equal(String(url), "https://exp.host/--/api/v2/push/send");
      const payload = JSON.parse(String(options.body));
      assert.equal(payload.length, 1);
      assert.equal(payload[0].to, token);
      assert.equal(payload[0].data.userId, owner);
      assert.ok(
        !JSON.stringify(payload).includes("simple bench"),
        "No description or photo is sent",
      );
      return Response.json({ data: [{ status: "ok", id: "fixture-ticket" }] });
    }) as typeof fetch;
    await deliverNotifications(f.db, provider);
    await deliverNotifications(f.db, provider);
    assert.equal(sends, 1);
    await f.pg.query("select siteai_register_push($1,$2,$3,'ios')", [
      other,
      deviceHash,
      token,
    ]);
    assert.equal(
      (
        await f.pg.query<{ user_id: string }>(
          "select user_id from siteai_push_devices",
        )
      ).rows[0].user_id,
      other,
    );
    await f.pg.query("delete from auth.users where id=$1", [owner]);
    assert.equal(
      (await f.pg.query("select * from siteai_push_outbox")).rows.length,
      0,
    );
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        (
          await f.pg.query<{ ok: boolean }>(
            "select has_table_privilege($1,'siteai_job_queue','SELECT') as ok",
            [role],
          )
        ).rows[0].ok,
        false,
      );
      assert.equal(
        (
          await f.pg.query<{ ok: boolean }>(
            "select has_function_privilege($1,'siteai_claim_queued_job(uuid,uuid)','EXECUTE') as ok",
            [role],
          )
        ).rows[0].ok,
        false,
      );
    }
  } finally {
    await f.pg.close();
    delete process.env.BILLING_ENABLED;
  }
});

test("matching plans retry automatically after a provider failure without another image, token or revision", async () => {
  const f = await backgroundFixture();
  process.env.BILLING_ENABLED = "true";
  try {
    let planCalls = 0;
    const { DesignError } = await import("../lib/services/image-design");
    const dependencies = {
      ...f.dependencies,
      design: async (
        ...args: Parameters<NonNullable<typeof f.dependencies.design>>
      ) => ({
        ...(await f.dependencies.design!(...args)),
        planStatus: "unavailable" as const,
        planRetryable: true,
      }),
      plan: async (
        ...args: Parameters<NonNullable<typeof f.dependencies.plan>>
      ) => {
        planCalls++;
        if (planCalls < 3)
          throw new DesignError("Planner temporarily unavailable", 503);
        return f.dependencies.plan!(...args);
      },
    };
    await enqueueJob(f.request(), "design", () => {}, dependencies);
    for (let attempt = 0; attempt < 3; attempt++) {
      await f.pg.exec(
        "update siteai_job_queue set due_at=now()-interval '1 second'",
      );
      await processQueuedJob(jobId, f.db, dependencies);
    }
    assert.equal(planCalls, 3);
    assert.equal(f.calls().designs, 1);
    assert.equal(await f.balance(), 1);
    assert.equal(
      (await f.pg.query<{ state: string }>("select state from buildly_jobs"))
        .rows[0].state,
      "complete",
    );
    assert.equal(
      (
        await f.pg.query<{ revisions: number }>(
          "select revisions from buildly_project_access",
        )
      ).rows[0].revisions,
      3,
    );
  } finally {
    await f.pg.close();
    delete process.env.BILLING_ENABLED;
  }
});
