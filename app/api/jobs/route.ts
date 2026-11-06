import { after } from "next/server";
import { enqueueJob, processQueuedJob } from "@/lib/production/job-queue";
import { type JobKind } from "@/lib/production/jobs";
import { ownedProject } from "@/lib/production/projects";
import { DesignError } from "@/lib/services/image-design";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const kind = new URL(req.url).searchParams.get("kind");
    if (!["design", "refine", "plan"].includes(kind || ""))
      throw new DesignError("Choose a valid request type.", 400);
    const result = await enqueueJob(req, kind as JobKind, (id) =>
      after(async () => {
        await processQueuedJob(id).catch(() =>
          console.warn("siteai_background_start_deferred", { id }),
        );
      }),
    );
    return Response.json(result, {
      status: result.state === "running" ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof DesignError
            ? e.message
            : "Your request could not finish. Check your projects before trying again.",
      },
      { status: e instanceof DesignError ? e.status : 503 },
    );
  }
}
export async function GET(req: Request) {
  try {
    // Reading completed work stays available even when new generation is paused.
    const { authenticatedUser } = await import("@/lib/billing/server");
    const { db, user } = await authenticatedUser(req);
    const id = new URL(req.url).searchParams.get("id");
    const summary = !id && new URL(req.url).searchParams.get("summary") === "1";
    if (id && !/^[a-f0-9-]{36}$/i.test(id))
      throw new DesignError("Invalid request.", 400);
    let query = db
      .from("buildly_jobs")
      .select(
        "id,kind,state,source_id,result_id,created_at,expires_at,failure_code,failure_message",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (id) query = query.eq("id", id);
    const { data, error } = await query;
    if (error)
      throw new DesignError("Request history could not load. Try again.", 503);
    const ids = (data || []).map((job) => job.id);
    const queued = ids.length
      ? await db
          .from("siteai_job_queue")
          .select("job_id,status")
          .in("job_id", ids)
      : { data: [] };
    const background = new Set(
      (queued.data || [])
        .filter((row) => ["queued", "working"].includes(row.status))
        .map((row) => row.job_id),
    );
    const jobs = await Promise.all(
      (data || []).map(async (job) => ({
        ...job,
        background: background.has(job.id),
        state:
          ["running", "image_saved"].includes(job.state) &&
          Date.parse(job.expires_at) < Date.now()
            ? "interrupted"
            : job.state,
        project:
          !summary && job.result_id
            ? await ownedProject(db, user.id, job.result_id).catch(() => null)
            : null,
      })),
    );
    if (id && !jobs.length)
      throw new DesignError("This request could not be found.", 404);
    return Response.json(
      { jobs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof DesignError
            ? e.message
            : "Request history could not load.",
      },
      { status: e instanceof DesignError ? e.status : 503 },
    );
  }
}
