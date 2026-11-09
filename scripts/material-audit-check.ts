import assert from "node:assert/strict";
import { adminClient } from "../lib/billing/server";
import { loadProjectImages, ownedProject } from "../lib/production/projects";
import { createDesignPlan } from "../lib/services/design-plan";
import { reviewRevisionDesign } from "../lib/services/revision-audit";
import { materialAuditIssues } from "../lib/material-audit";
import { materialPurchase } from "../lib/material-purchase";
import type { Project } from "../lib/project";
import { DesignError } from "../lib/services/image-design";
import { generationAccount } from "../lib/production/access";

// Explicit operator opt-in for the reported incident only. Read saved images,
// run the real planner/reviewer, never write projects or reserve user credits.
async function main() {
  assert.equal(process.env.SITEAI_MATERIAL_AUDIT_QA, "1");
  const id = process.env.SITEAI_AUDIT_PROJECT_ID;
  assert.ok(id && /^[a-zA-Z0-9-]{1,80}$/.test(id));
  const db = adminClient();
  const { data, error } = await db
    .from("projects")
    .select("user_id,payload")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  assert.ok(!error && data, "The authorized incident project must exist");
  const account = await db.auth.admin.getUserById(data.user_id);
  assert.ok(
    !account.error && account.data.user,
    "The account must remain active",
  );
  await generationAccount({ db, user: account.data.user }, true);
  const saved = data.payload as Project;
  const old = saved.materials.filter((m) => /screws?/i.test(m.item));
  assert.ok(
    old.some((m) => (materialPurchase(m).total || 0) >= 10000),
    "This check is restricted to the reported extreme screw estimate",
  );
  const start = Date.now();
  const project = await loadProjectImages(db, data.user_id, saved);
  const fields = await createDesignPlan(project, { timeoutMs: 120000 });
  assert.equal(fields.planStatus, "design-based");
  assert.equal(fields.materialsAuditVersion, "unit-price-review-v1");
  assert.ok(fields.materials?.length && fields.steps?.length);
  assert.deepEqual(materialAuditIssues(fields.materials), []);
  const hardware = fields.materials.filter((m) =>
    /screw|nail|fastener/i.test(m.item),
  );
  assert.ok(hardware.length > 0);
  const totals = hardware.map((m) => materialPurchase(m).total);
  assert.ok(
    totals.every((n) => n !== null && n > 0 && n < 1000),
    "The incident's ordinary fasteners need sensible, positive purchase allowances",
  );
  let visualReview = "not_applicable";
  if (project.parentProjectId) {
    const parent = await loadProjectImages(
      db,
      data.user_id,
      await ownedProject(db, data.user_id, project.parentProjectId),
    );
    const reviewed = await reviewRevisionDesign(
      { ...parent, description: project.description },
      project.generatedImage,
      "Add handrails to the existing deck, preserving everything else.",
    );
    visualReview = reviewed.approved
      ? "accepted_existing_visual"
      : "would_request_correction";
  }
  console.info("siteai_material_audit_live_result", {
    complete: true,
    materials: fields.materials.length,
    phases: fields.steps.length,
    hardwareTotals: totals,
    totalLow: fields.estimatedCostLow,
    totalHigh: fields.estimatedCostHigh,
    visualReview,
    durationMs: Date.now() - start,
    customerWrites: 0,
    userCreditsCharged: 0,
    newImagesGenerated: 0,
  });
}
void main().catch((error) => {
  console.error("siteai_material_audit_live_failed", {
    code:
      error instanceof DesignError
        ? error.code || String(error.status)
        : "check_failed",
    customerWrites: 0,
    userCreditsCharged: 0,
  });
  process.exitCode = 1;
});
