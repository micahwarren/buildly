import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { planProject } from "../lib/services/project-planning";
import { refineProject } from "../lib/services/refine-project";
import { createDesignPlan } from "../lib/services/design-plan";
import type { Project } from "../lib/project";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { readProjectRequest } from "../lib/project-request";

async function main() {
  if (process.env.SIGHTSAW_LIVE_RELEASE_CHECK !== "1")
    throw Error("Live QA requires explicit opt-in.");
  const start = Date.now();
  // Original generated example with a recorded source; never a customer photo.
  // A prior public-stock fixture was restricted by the provider. Do not retry
  // that blocked input or weaken the provider's content restrictions.
  const fixture = await readFile(new URL("../tests/fixtures/siteai-original-space.png", import.meta.url));
  const originalJpeg = await sharp(fixture).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const originalImage = `data:image/jpeg;base64,${originalJpeg.toString("base64")}`;
  const hash = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  async function complete(p: Project) {
    // Same saved-image-only recovery as the production job; no new picture.
    if (p.planStatus !== "design-based" && p.planRetryable !== false)
      p = { ...p, ...(await createDesignPlan(p, { timeoutMs: 90_000 })) };
    assert.equal(
      p.planStatus,
      "design-based",
      p.planSummary || "Planning did not finish",
    );
    assert.equal(p.visualizationMode, "ai", "Live QA must never pass using a demo design");
    assert.ok(
      p.generatedImage.startsWith("data:image/") &&
        p.generatedImage.length > 1000,
    );
    assert.ok(p.materials.length > 2 && p.steps.length >= 6);
    assert.ok(
      p.materials.every((m) => m.quantity > 0 && m.unitCost > 0),
      "The dimensioned planter fixture needs quantity and price for every material",
    );
    assert.ok(
      p.estimatedCostLow > 0 && p.estimatedCostHigh >= p.estimatedCostLow,
    );
    assert.ok(
      p.steps.every(
        (s) => (s.actions?.length || 0) >= 3 && (s.checks?.length || 0) >= 1,
      ),
    );
    return p;
  }
  const firstStart = Date.now();
  const { input } = await readProjectRequest(new Request("https://site-ai-nomapps.vercel.app/api/jobs", {
    method: "POST", body: JSON.stringify({
      description:
        "Build two freestanding cedar planter boxes on the ground near the entrance. Each box is 4 feet long, 2 feet wide and 18 inches tall. Keep the building, windows, entrance, landscaping and existing features unchanged. Include the box bottoms, drainage and compatible fasteners. Leave them empty; do not buy plants or include unrelated equipment. These are two new boxes, not changes to the building.",
      projectType: "Something else",
      width: 2,
      length: 4,
      originalImage,
      experienceLevel: "Beginner",
      budget: "Not sure",
    }),
  }));
  const project = await complete(await planProject(input));
  const projectMs = Date.now() - firstStart;
  const revisionStart = Date.now();
  const revision = await complete(
    await refineProject(
      project,
      "Change both boxes to white painted exterior-grade plywood with white trim instead of cedar boards. Keep the same two boxes, dimensions and locations. Recalculate the plywood sheets, trim, primer, paint, fasteners, costs and plan for this changed material.",
    ),
  );
  assert.notEqual(revision.id, project.id);
  assert.equal(revision.parentProjectId, project.id);
  assert.equal(revision.originalImage, project.originalImage);
  assert.notEqual(
    hash(revision.generatedImage),
    hash(project.generatedImage),
    "Revision must create a new image",
  );
  assert.notEqual(
    hash(revision.materials),
    hash(project.materials),
    "Revision must create matching new materials",
  );
  assert.notEqual(
    hash(revision.steps),
    hash(project.steps),
    "Revision must create a matching new plan",
  );
  assert.match(JSON.stringify(revision.materials), /plywood/i);
  if (process.env.SITEAI_LIVE_SAMPLE_EXPORT === "1") {
    // Only this original synthetic example is exported. No account, customer
    // image or session data enters the artifact. JPEG delivery uses the same
    // normalization as ordinary app inputs; the original PNG is retained.
    await mkdir("public/appstore", { recursive: true });
    const edited = Buffer.from(project.generatedImage.split(",")[1], "base64");
    const sample = { ...project, originalImage: "/appstore/space.jpg", generatedImage: "/appstore/patio.jpg" };
    const changed = { ...revision, originalImage: "/appstore/space.jpg", generatedImage: "/appstore/revision.jpg" };
    const files: [string, Buffer][] = [["space.jpg", originalJpeg], ["patio.jpg", edited], ["projects.json", Buffer.from(JSON.stringify([sample]))], ["revision.jpg", Buffer.from(revision.generatedImage.split(",")[1], "base64")], ["revision.json", Buffer.from(JSON.stringify(changed))]];
    for (const [name, bytes] of files) {
      await writeFile("public/appstore/" + name, bytes);
      const encoded = bytes.toString("base64");
      for (let offset = 0; offset < encoded.length; offset += 6000)
        console.info(`SITEAI_QA_PUBLIC_ARTIFACT ${name} ${offset} ${encoded.slice(offset, offset + 6000)}`);
    }
  }
  console.info(
    "sightsaw_live_release_check",
    JSON.stringify({
      status: "pass",
      projectMs,
      revisionMs: Date.now() - revisionStart,
      totalMs: Date.now() - start,
      projectMaterials: project.materials.length,
      projectPhases: project.steps.length,
      revisionMaterials: revision.materials.length,
      revisionPhases: revision.steps.length,
      imagesChanged: true,
      materialsChanged: true,
      planChanged: true,
      allFixtureMaterialsPriced: true,
      source: "Original generated example space; see tests/fixtures/siteai-original-space.source.json",
      customerDataWrites: 0,
    }),
  );
}
void main().catch((error) => {
  console.error(
    "sightsaw_live_release_check_failed",
    error instanceof Error ? error.message : "Unknown release-check failure",
  );
  process.exitCode = 1;
});
