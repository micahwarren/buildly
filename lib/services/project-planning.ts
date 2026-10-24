import { makeDemo, type Project } from "../project";
import { createDesignPlan, unavailablePlan } from "./design-plan";
import { createDesign } from "./image-design";
/** Generate the concept, then ground its plan in both photos. Keep the image if planning fails. */
export async function planProject(
  input: Partial<Project>,
  demo = false,
  dependencies: {
    design?: typeof createDesign;
    plan?: typeof createDesignPlan;
  } = {},
) {
  const project = makeDemo(input);
  const design = await (dependencies.design ?? createDesign)(project, demo, {
    timeoutMs: 150000,
  });
  const result = {
    ...project,
    generatedImage: design.generatedImage,
    visualizationMode: design.mode,
  };
  if (demo) return result;
  try {
    return {
      ...result,
      ...(await (dependencies.plan ?? createDesignPlan)(result)),
    };
  } catch (error) {
    return {
      ...result,
      ...unavailablePlan(
        error instanceof Error
          ? error.message
          : "Planning failed. Retry from your saved design.",
      ),
    };
  }
}
