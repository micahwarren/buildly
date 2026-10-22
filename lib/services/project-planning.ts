import { makeDemo, type Project } from "../project";
import { analyzeImage } from "./image-analysis";
import { createDesign } from "./image-design";
/** Server-only orchestration; live providers can replace each service independently. */
export async function planProject(input: Partial<Project>) {
  const analysis = await analyzeImage(input.originalImage || "");
  const design = await createDesign(
    analysis.originalImage,
    input.projectType || "Pergola",
  );
  return makeDemo({ ...input, generatedImage: design.generatedImage });
}
