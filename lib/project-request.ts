import { parseDetails } from "./project-details";
import type { Project } from "./project";
import { DesignError } from "./services/image-design";
export async function readProjectRequest(
  req: Request,
): Promise<{ input: Partial<Project>; demo: boolean }> {
  if (Number(req.headers.get("content-length")) > 4_000_000)
    throw new DesignError("Please use a smaller photo.", 413);
  let data;
  try {
    data = await req.json();
  } catch {
    throw new DesignError("Please send a valid project.", 400);
  }
  const types = ["Deck", "Pergola", "Patio", "Fence", "Shed", "Something else"];
  if (
    !data ||
    typeof data.originalImage !== "string" ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(
      data.originalImage,
    ) ||
    data.originalImage.length > 3_500_000 ||
    typeof data.description !== "string" ||
    !data.description.trim() ||
    data.description.length > 2000 ||
    !types.includes(data.projectType)
  )
    throw new DesignError(
      "Please add a valid photo, choose a project, and describe your idea.",
      400,
    );
  if (
    !Number.isFinite(data.width) ||
    !Number.isFinite(data.length) ||
    data.width < 1 ||
    data.width > 100 ||
    data.length < 1 ||
    data.length > 200
  )
    throw new DesignError(
      "Please enter width from 1–100 feet and length from 1–200 feet.",
      400,
    );
  let details;
  try {
    details = parseDetails(data.details);
  } catch (error) {
    throw new DesignError(
      error instanceof Error ? error.message : "Invalid project details.",
      400,
    );
  }
  return {
    input: {
      projectType: data.projectType,
      description: data.description.trim(),
      details,
      originalImage: data.originalImage,
      width: data.width,
      length: data.length,
      budget:
        typeof data.budget === "string"
          ? data.budget.slice(0, 100)
          : "Not sure",
      experienceLevel:
        typeof data.experienceLevel === "string"
          ? data.experienceLevel.slice(0, 100)
          : "Beginner",
    },
    demo: data.mode === "demo",
  };
}
