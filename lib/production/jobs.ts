import { withOperation } from "./telemetry";
import { createHash } from "node:crypto";
import { billed } from "../billing/server";
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
export async function executeJob(
  req: Request,
  kind: JobKind,
  consent = true,
  dependencies: {
    authorize?: typeof generationUser;
    design?: typeof planProject;
    refine?: typeof refineProject;
    plan?: typeof createDesignPlan;
  } = {},
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
  const claim = await db.rpc("buildly_claim_job", {
    p_user: user.id,
    p_id: id,
    p_kind: kind,
    p_source: source,
    p_hash: hash,
    p_daily: limit(process.env.BUILDLY_DAILY_REQUESTS, 20, 100),
    p_global: limit(process.env.BUILDLY_GLOBAL_DAILY_REQUESTS, 50, 10000),
  });
  if (claim.error) throw jobError(claim.error.message);
  if (!claim.data.claimed) {
    const job = claim.data.job;
    if (job.result_id)
      return {
        jobId: id,
        state: job.state,
        project: await ownedProject(db, user.id, job.result_id),
      };
    return { jobId: id, state: job.state };
  }
  const started = Date.now();
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
    await update({ state: "image_saved", result_id: p.id });
  }
  try {
    const result = await withOperation(id, () =>
      billed(
        req,
        kind === "plan" ? "plan" : "design",
        source || id,
        async () => {
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
                id: source!,
                title: project!.title,
                generatedImage: loaded.generatedImage,
              },
              data.change.trim(),
              { id, onDesign: checkpoint },
            );
          } else
            p = await (dependencies.design || planProject)(
              { ...input, id },
              false,
              { onDesign: checkpoint },
            );
          const stored = await persistProject(db, user.id, p);
          await update({ state: "complete", result_id: p.id });
          return stored;
        },
      ),
    );
    console.info("buildly_job", {
      id,
      kind,
      state: "complete",
      durationMs: Date.now() - started,
    });
    return {
      jobId: id,
      state: "complete",
      project: consent ? result : await loadProjectImages(db, user.id, result),
    };
  } catch (error) {
    await update({
      state: "failed",
      failure_code:
        error instanceof DesignError ? String(error.status) : "internal",
    }).catch(() => {});
    console.warn("buildly_job", {
      id,
      kind,
      state: "failed",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}
