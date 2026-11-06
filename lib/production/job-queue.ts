import { randomUUID } from "node:crypto";
import { adminClient } from "../billing/server";
import { generationAccount } from "./access";
import {
  prepareJob,
  runPreparedJob,
  type JobKind,
  type JobDependencies,
} from "./jobs";
import { ownedProject } from "./projects";
import { jobError } from "./errors";
import { DesignError } from "../services/image-design";
import { notifyReady, deliverNotifications } from "./notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

const configuredLimit = (
  value: string | undefined,
  fallback: number,
  max: number,
) =>
  value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max
    ? Number(value)
    : fallback;
export async function enqueueJob(
  req: Request,
  kind: JobKind,
  schedule: (id: string) => void,
  dependencies: JobDependencies = {},
) {
  const prepared = await prepareJob(req, kind, dependencies);
  const { db, user, id, source, hash, text } = prepared;
  const claimed = await db.rpc("siteai_enqueue_job", {
    p_user: user.id,
    p_id: id,
    p_kind: kind,
    p_source: source,
    p_hash: hash,
    p_input: text,
    p_daily: configuredLimit(
      process.env.SIGHTSAW_DAILY_REQUESTS ?? process.env.BUILDLY_DAILY_REQUESTS,
      20,
      100,
    ),
    p_global: configuredLimit(
      process.env.SIGHTSAW_GLOBAL_DAILY_REQUESTS ??
        process.env.BUILDLY_GLOBAL_DAILY_REQUESTS,
      50,
      10000,
    ),
  });
  if (claimed.error) throw jobError(claimed.error.message);
  const job = claimed.data.job;
  if (["running", "image_saved"].includes(job.state)) schedule(id);
  return {
    jobId: id,
    state: job.state,
    background: true,
    ...(job.result_id
      ? { project: await ownedProject(db, user.id, job.result_id) }
      : {}),
    failure_code: job.failure_code || undefined,
    failure_message: job.failure_message || undefined,
  };
}
export async function processQueuedJob(
  id: string,
  db: SupabaseClient = adminClient(),
  dependencies: JobDependencies = {},
) {
  const lease = randomUUID();
  const claimed = await db.rpc("siteai_claim_queued_job", {
    p_id: id,
    p_lease: lease,
  });
  if (claimed.error) throw new Error("Queue lease could not be acquired");
  if (!claimed.data) return;
  const { job, input } = claimed.data;
  let retry = false;
  try {
    const account = await db.auth.admin.getUserById(job.user_id);
    if (account.error || !account.data.user)
      throw new DesignError("Account is unavailable.", 401);
    const user = account.data.user;
    await generationAccount({ db, user }, true);
    let prepared;
    if (job.result_id) {
      // Resume the matching plan after an image checkpoint. Never regenerate its image.
      const project = await ownedProject(db, user.id, job.result_id);
      prepared = {
        db,
        user,
        id,
        kind: "plan" as const,
        source: project.id,
        project,
        input: {},
        text: JSON.stringify({ id: project.id }),
        hash: job.request_hash,
      };
    } else {
      const req = new Request("https://site-ai-nomapps.vercel.app/api/jobs", {
        method: "POST",
        headers: { "idempotency-key": id },
        body: input,
      });
      prepared = await prepareJob(req, job.kind, {
        ...dependencies,
        authorize: async () => ({ db, user }),
      });
    }
    const result = await runPreparedJob(prepared, true, dependencies);
    retry =
      result.state === "image_saved" && result.project?.planRetryable !== false;
    if (result.state === "complete") {
      await notifyReady(db, user.id, id, result.project.id).catch(() =>
        console.warn("siteai_notification_enqueue_deferred", { id }),
      );
    }
  } catch (error) {
    const permanent =
      error instanceof DesignError &&
      [400, 401, 402, 403, 404, 409, 413, 422].includes(error.status);
    retry = !permanent;
    if (permanent)
      await db
        .from("buildly_jobs")
        .update({
          state: "failed",
          failure_code: String(error.status),
          failure_message: error.message.slice(0, 1200),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", job.user_id);
    console.warn("siteai_background_job", {
      id,
      outcome: retry ? "retry" : "stopped",
      code:
        error instanceof DesignError
          ? error.code || String(error.status)
          : "internal",
    });
  } finally {
    const done = await db.rpc("siteai_finish_queued_job", {
      p_id: id,
      p_lease: lease,
      p_retry: retry,
    });
    if (done.error) console.warn("siteai_background_finalize", { id });
  }
  await deliverNotifications(db).catch(() =>
    console.warn("siteai_notification_delivery_deferred"),
  );
}
export async function sweepBackgroundWork(db: SupabaseClient = adminClient()) {
  const ready = await db
    .from("siteai_job_queue")
    .select("job_id")
    .in("status", ["queued", "working"])
    .lte("due_at", new Date().toISOString())
    .order("created_at")
    .limit(4);
  if (ready.error) throw Error("Queue could not load");
  await Promise.allSettled(
    (ready.data || []).map((row) => processQueuedJob(row.job_id, db)),
  );
  // Repair the tiny completion/outbox crash window; uniqueness prevents repeated sends.
  const awaiting = await db
    .from("siteai_job_queue")
    .select("job_id")
    .eq("status", "done")
    .eq("notification_checked", false)
    .limit(50);
  if (!awaiting.error && awaiting.data?.length) {
    const completed = await db
      .from("buildly_jobs")
      .select("id,user_id,result_id")
      .eq("state", "complete")
      .in(
        "id",
        awaiting.data.map((row) => row.job_id),
      );
    if (!completed.error)
      for (const job of completed.data || [])
        if (job.result_id)
          await notifyReady(db, job.user_id, job.id, job.result_id).catch(
            () => {},
          );
  }
  await deliverNotifications(db);
}
