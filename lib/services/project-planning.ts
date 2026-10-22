import { makeDemo, type Project } from "../project";
import { createDesign } from "./image-design";
/** Visualization is live when configured. Materials remain explicitly illustrative. */
export async function planProject(input: Partial<Project>, demo = false) {
  const project = makeDemo(input);
  const design = await createDesign(project, demo);
  return {
    ...project,
    generatedImage: design.generatedImage,
    visualizationMode: design.mode,
  };
}
