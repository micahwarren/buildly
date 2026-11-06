import { withOperation } from "./telemetry";
import { createHash } from "node:crypto";
import { billedForAccount } from "../billing/server";
import { generationUser } from "./access";
import { jobError } from "./errors";
import { ownedProject, loadProjectImages, persistProject } from "./projects";
import { DesignError } from "../services/image-design";
import { planProject } from "../services/project-planning";
import { refineProject } from "../services/refine-project";
import { createDesignPlan, unavailablePlan } from "../services/design-plan";
import { readProjectRequest } from "../project-request";
import type { Project } from "../project";
export type JobKind = "design" | "refine" | "plan";
const validId = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const limit = (value: string | undefined, fallback: number, max: number) =>
  value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max
    ? Number(value)
    : fallback;
export type JobDependencies = {
  authorize?: typeof generationUser;
  design?: typeof planProject;
  refine?: typeof refineProject;
  plan?: typeof createDesignPlan;
};
export async function prepareJob(
  req: Request,
  kind: JobKind,
  dependencies: JobDependencies = {},
) {
  const { db, user } = await (dependencies.authorize || generationUser)(
    req,
    true,
  );
  const text = await req.text();
  if (text.length > 4_400_000)
    throw new DesignError("Please use smaller photos.", 413);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DesignError("Please send a valid request.", 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new DesignError("Please send a valid request.", 400);
  const id = req.headers.get("idempotency-key") || crypto.randomUUID();
  if (!validId(id))
    throw new DesignError("Please start a new request from the app.", 400);
  const source =
    typeof data.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(data.id)
      ? data.id
      : null;
  let project: Project | undefined;
  if (kind !== "design") {
    if (!source) throw new DesignError("Open a saved project first.", 400);
    project = await ownedProject(db, user.id, source);
  }
  if (
    kind === "refine" &&
    (typeof data.change !== "string" ||
      !data.change.trim() ||
      data.change.length > 1000)
  )
    throw new DesignError(
      "Describe your change in under 1,000 characters.",
      400,
    );
  const { input } =
    kind === "plan"
      ? { input: {} }
      : await readProjectRequest(
          new Request(req.url, { method: "POST", body: text }),
        );
  const hash = createHash("sha256")
    .update(kind + "\n" + text)
    .digest("hex");
  return { db, user, kind, id, source, project, input, text, hash };
}
export type PreparedJob = Awaited<ReturnType<typeof prepareJob>>;
export async function executeJob(
  req: Request,
  kind: JobKind,
  consent = true,
  dependencies: JobDependencies = {},
): Promise<{
  jobId: string;
  state: string;
  project?: Project;
  failure_code?: string;
  failure_message?: string;
}> {
  const prepared = await prepareJob(req, kind, dependencies);
  const { db, user, id, source, hash } = prepared;
  const claim = await db.rpc("buildly_claim_job", {
    p_user: user.id,
    p_id: id,
    p_kind: kind,
    p_source: source,
    p_hash: hash,
    p_daily: limit(
      process.env.SIGHTSAW_DAILY_REQUESTS ?? process.env.BUILDLY_DAILY_REQUESTS,
      20,
      100,
    ),
    p_global: limit(
      process.env.SIGHTSAW_GLOBAL_DAILY_REQUESTS ??
        process.env.BUILDLY_GLOBAL_DAILY_REQUESTS,
      50,
      10000,
    ),
  });
  if (claim.error) throw jobError(claim.error.message);
  if (!claim.data.claimed) {
    const job = claim.data.job;
    if (job.result_id)
      return {
        jobId: id,
        state: job.state,
        failure_code: job.failure_code || undefined,
        failure_message: job.failure_message || undefined,
        project: await ownedProject(db, user.id, job.result_id),
      };
    return {
      jobId: id,
      state: job.state,
      failure_message: job.failure_message || undefined,
      failure_code: job.failure_code || undefined,
    };
  }
  return runPreparedJob(prepared, consent, dependencies);
}
export async function runPreparedJob(
  prepared: PreparedJob,
  consent = true,
  dependencies: JobDependencies = {},
) {
  const { db, user, id, kind, source, project, input } = prepared;
  const data = JSON.parse(prepared.text);
  const started = Date.now();
  let confirmDelivered: ((id: string) => Promise<void>) | null = null;
  async function update(values: object) {
    const { error } = await db
      .from("buildly_jobs")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error)
      throw new DesignError(
        "Your request status could not save. Check your projects before retrying.",
        503,
      );
  }
  async function checkpoint(p: Project) {
    await persistProject(db, user.id, {
      ...p,
      ...unavailablePlan(
        "Your design is saved. Its matching plan can be retried.",
      ),
    });
    await confirmDelivered?.(p.id);
    await update({ state: "image_saved", result_id: p.id });
  }
  try {
    const result = await withOperation(id, () =>
      billedForAccount(
        { db, user },
        kind === "plan" ? "plan" : "design",
        source || id,
        async (delivered) => {
          confirmDelivered = delivered;
          let p: Project;
          if (kind === "plan") {
            const loaded = await loadProjectImages(db, user.id, project!);
            const fields = await (dependencies.plan || createDesignPlan)(
              loaded,
            );
            // Preserve a name change made while the plan was running.
            p = {
              ...(await ownedProject(db, user.id, source!)),
              ...fields,
              updatedAt: new Date().toISOString(),
            };
          } else if (kind === "refine") {
            const loaded = await loadProjectImages(db, user.id, project!);
            p = await (dependencies.refine || refineProject)(
              {
                ...loaded,
                ...input,
                // Omitted optional measurements do not erase known dimensions.
                width:
                  data.width == null
                    ? loaded.width
                    : (input as Partial<Project>).width!,
                length:
                  data.length == null
                    ? loaded.length
                    : (input as Partial<Project>).length!,
                id: source!,
                title: project!.title,
                generatedImage: loaded.generatedImage,
              },
              data.change.trim(),
              { id, onDesign: checkpoint, deadline: started + 260_000 },
            );
          } else
            p = await (dependencies.design || planProject)(
              { ...input, id },
              false,
              { onDesign: checkpoint, deadline: started + 260_000 },
            );
          // The paid image checkpoint is durable. Recover only its matching
          // plan, never another image or another project/revision charge.
          if (
            kind !== "plan" &&
            p.planStatus !== "design-based" &&
            p.planRetryable !== false
          ) {
            const remaining = 280_000 - (Date.now() - started);
            if (remaining > 15_000) {
              await update({ state: "image_saved", result_id: p.id });
              try {
                const fields = await (dependencies.plan || createDesignPlan)(
                  p,
                  { timeoutMs: Math.min(90_000, remaining) },
                );
                p = {
                  ...p,
                  ...fields,
                  title: p.parentProjectId
                    ? p.title
                    : fields.suggestedTitle || p.title,
                };
              } catch (error) {
                p = {
                  ...p,
                  ...unavailablePlan(
                    error instanceof Error
                      ? error.message
                      : "The matching plan could not finish.",
                    error,
                  ),
                };
              }
            }
          }
          const stored = await persistProject(db, user.id, p);
          const finished = p.planStatus === "design-based";
          await update({
            state: finished ? "complete" : "image_saved",
            result_id: p.id,
            failure_message: null,
            failure_code: finished
              ? null
              : p.planRetryable === false
                ? "plan_blocked"
                : "plan_pending",
          });
          if (kind === "plan" && finished) {
            const recovered = await db
              .from("buildly_jobs")
              .update({
                state: "complete",
                failure_code: null,
                failure_message: null,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", user.id)
              .eq("result_id", p.id)
              .eq("state", "image_saved");
            if (recovered.error)
              console.warn("sightsaw_plan_parent_status", {
                id,
                state: "refresh_needed",
              });
          }
          return stored;
        },
        false,
        id,
      ),
    );
    console.info("sightsaw_job", {
      id,
      kind,
      state: result.planStatus === "design-based" ? "complete" : "image_saved",
      durationMs: Date.now() - started,
    });
    return {
      jobId: id,
      state: result.planStatus === "design-based" ? "complete" : "image_saved",
      failure_code:
        result.planStatus === "design-based"
          ? undefined
          : result.planRetryable === false
            ? "plan_blocked"
            : "plan_pending",
      project: consent ? result : await loadProjectImages(db, user.id, result),
    };
  } catch (error) {
    await update({
      state: "failed",
      failure_code:
        error instanceof DesignError
          ? error.code || String(error.status)
          : "internal",
      failure_message:
        error instanceof DesignError ? error.message.slice(0, 1200) : null,
    }).catch(() => {});
    console.warn("sightsaw_job", {
      id,
      kind,
      state: "failed",
      durationMs: Date.now() - started,
      // Codes identify the failing stage without logging photos or user text.
      failure:
        error instanceof DesignError
          ? error.code || String(error.status)
          : "internal",
    });
    throw error;
  }
}
