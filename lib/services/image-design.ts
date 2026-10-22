import { photos } from "../project";
/** Provider boundary: supply the original photo as an edit input, preserving the scene. */
export async function createDesign(originalImage: string, projectType: string) {
  const key = projectType.toLowerCase() as keyof typeof photos;
  return {
    originalImage,
    generatedImage: photos[key] || photos.pergola,
    mode: "demo" as const,
  };
}
