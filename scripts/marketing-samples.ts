import { readFile, writeFile, mkdir } from "node:fs/promises";
import { planProject } from "../lib/services/project-planning";
import { createDesignPlan } from "../lib/services/design-plan";
async function main() {
if (process.env.SITEAI_MARKETING_SAMPLES !== "1")
  throw Error("Explicit marketing generation opt-in required");
const before =
  "data:image/jpeg;base64," +
  (await readFile("public/appstore/space.jpg")).toString("base64");
await mkdir("public/appstore", { recursive: true });
const ideas = [
  [
    "patio",
    "Add two freestanding cedar planter boxes and a simple cedar bench with cream seat cushions. Keep the existing concrete patio and brick house unchanged. Warm minimalist outdoor lounge, portable planters and no structural additions.",
  ],
  [
    "garden",
    "Create a low-maintenance container garden with three freestanding wooden planter boxes along the patio edges and a small movable potting table. Keep the house and slab unchanged; use buyable plants and soil, not DIY-made plants.",
  ],
];
const projects = await Promise.all(
  ideas.map(async ([slug, description]) => {
    let p = await planProject({
      originalImage: before,
      description,
      projectType: "Something else",
      width: 12,
      length: 16,
      experienceLevel: "Beginner",
      budget: "Not sure",
    });
    if (p.planStatus !== "design-based")
      p = { ...p, ...(await createDesignPlan(p, { timeoutMs: 100000 })) };
    if (
      p.planStatus !== "design-based" ||
      !p.materials.length ||
      !p.steps.length
    )
      throw Error("Marketing example plan did not complete");
    const image = /^data:image\/(\w+);base64,([\s\S]+)$/.exec(p.generatedImage);
    if (!image) throw Error("Marketing design image missing");
    await writeFile(
      `public/appstore/${slug}.${image[1]}`,
      Buffer.from(image[2], "base64"),
    );
    p = {
      ...p,
      originalImage: "/appstore/space.jpg",
      generatedImage: `/appstore/${slug}.${image[1]}`,
    };
    console.log(
      "Marketing example created:",
      slug,
      "materials:",
      p.materials.length,
      "steps:",
      p.steps.length,
    );
    return p;
  }),
);
await writeFile("public/appstore/projects.json", JSON.stringify(projects));

}
main().catch(error => { console.error(error); process.exitCode=1; });
