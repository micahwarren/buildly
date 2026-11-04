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
    onDesign?: (project: Project) => Promise<void>;
    deadline?: number;
  } = {},
): Promise<Project> {
  const project = makeDemo(input);
  const design = await (dependencies.design ?? createDesign)(project, demo, {
    timeoutMs: 150000,
  });
  const result = {
    ...project,
    generationVersion: "complete-v2",
    generatedImage: design.generatedImage,
    visualizationMode: design.mode,
  };
  if (demo) return result;
  await dependencies.onDesign?.(result);
  try {
    const fields = await (dependencies.plan ?? createDesignPlan)(result, {
      timeoutMs: Math.max(
        1000,
        (dependencies.deadline ?? Date.now() + 120_000) - Date.now(),
      ),
    });
    return {
      ...result,
      ...fields,
      title: fields.suggestedTitle || result.title,
    };
  } catch (error) {
    return {
      ...result,
      ...unavailablePlan(
        error instanceof Error
          ? error.message
          : "Planning failed. Retry from your saved design.",
        error,
      ),
    };
  }
}
