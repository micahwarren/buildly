import { parseDetails } from "./project-details";
import type { Project } from "./project";
import { DesignError } from "./services/image-design";
export async function readProjectRequest(
  req: Request,
): Promise<{ input: Partial<Project>; demo: boolean }> {
  if (Number(req.headers.get("content-length")) > 4_400_000)
    throw new DesignError("Please use a smaller photo.", 413);
  let data;
  try {
    const text = await req.text();
    if (text.length > 4_400_000)
      throw new DesignError("Please use smaller photos.", 413);
    data = JSON.parse(text);
  } catch (error) {
    if (error instanceof DesignError) throw error;
    throw new DesignError("Please send a valid project.", 400);
  }

  if (
    !data ||
    typeof data.originalImage !== "string" ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(
      data.originalImage,
    ) ||
    data.originalImage.length > 3_500_000 ||
    typeof data.description !== "string" ||
    !data.description.trim() ||
    data.description.length > 2000
  )
    throw new DesignError(
      "Please add a valid photo and describe your idea.",
      400,
    );
  // Zero represents an unknown dimension internally, never a measured size.
  const dimension = (value: unknown, max: number) => {
    if (value === undefined || value === null || value === "" || value === 0)
      return 0;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > max
    )
      throw new DesignError(
        `Measurements must be positive numbers, up to ${max} feet, or left blank.`,
        400,
      );
    return value;
  };
  const width = dimension(data.width, 100),
    length = dimension(data.length, 200);
  const attachments = (value: unknown): string[] => {
    if (value === undefined) return [];
    if (
      !Array.isArray(value) ||
      value.length > 2 ||
      value.some(
        (image) =>
          typeof image !== "string" ||
          image.length > 600_000 ||
          !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(image),
      )
    )
      throw new DesignError(
        "Add up to two smaller photos for each reference type.",
        400,
      );
    return value;
  };
  const referenceImages = attachments(data.referenceImages);
  const materialImages = attachments(data.materialImages);
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
      projectType:
        typeof data.projectType === "string"
          ? data.projectType.slice(0, 80)
          : "Something else",
      referenceImages,
      materialImages,
      description: data.description.trim(),
      details,
      originalImage: data.originalImage,
      width,
      length,
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
