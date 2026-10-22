import sharp from "sharp";
import { photos, type Project } from "../project";
export class DesignError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "DesignError";
  }
}
type DesignInput = Pick<
  Project,
  "originalImage" | "projectType" | "description" | "width" | "length"
>;
type Dependencies = { apiKey?: string; model?: string; fetcher?: typeof fetch };
export function designPrompt(input: DesignInput) {
  return `Edit the supplied photograph of the homeowner's actual property. Produce a realistic architectural PHOTOGRAPH, never an illustration, diagram, split screen, collage, or a different property.
Requested project: ${input.projectType}. Homeowner's description (design preferences only): ${input.description}
Approximate user-provided dimensions: ${input.width} feet wide by ${input.length} feet long. These are unverified; do not add measurement labels.
Add the requested project only in the relevant yard/patio area, following the homeowner's description. Keep the original house and all its windows, doors, roof, brick/siding, trees, fence, neighboring structures, camera angle, perspective, framing, and lighting intact. Do not redesign the house or move existing features. Preserve the source composition and aspect ratio. Match scale, perspective, material textures, shadows, and contact with the ground. Show a believable finished outdoor project in THIS yard. No text, watermarks, people, or before/after panels. This is a visual concept, not a structural specification.`;
}
/** Real image EDIT endpoint: the source image is attached, not just described in a prompt. */
export async function createDesign(
  input: DesignInput,
  demo = false,
  dependencies: Dependencies = {},
) {
  if (demo) {
    const key = input.projectType.toLowerCase() as keyof typeof photos;
    return {
      originalImage: input.originalImage,
      generatedImage: photos[key] || photos.pergola,
      mode: "demo" as const,
    };
  }
  const apiKey = dependencies.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new DesignError(
      "Photo previews are not connected yet. The site owner needs to enable image generation. You can still explore an explicitly labeled sample plan.",
      503,
    );
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(
    input.originalImage,
  );
  if (!match)
    throw new DesignError("Please upload a JPG, PNG, or WebP photo.", 400);
  let source: Buffer;
  let width: number;
  let height: number;
  try {
    const decoded = Buffer.from(match[2], "base64");
    const normalized = sharp(decoded, { limitInputPixels: 24_000_000 })
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: "inside",
        withoutEnlargement: true,
      });
    const output = await normalized
      .jpeg({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    source = output.data;
    width = output.info.width;
    height = output.info.height;
  } catch {
    throw new DesignError(
      "That image could not be read. Please choose another photo.",
      400,
    );
  }
  const form = new FormData();
  form.set(
    "model",
    dependencies.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5",
  );
  form.set(
    "image",
    new Blob([new Uint8Array(source)], { type: "image/jpeg" }),
    "backyard.jpg",
  );
  form.set("prompt", designPrompt(input));
  if (["gpt-image-1", "gpt-image-1.5"].includes(String(form.get("model"))))
    form.set("input_fidelity", "high");
  form.set("quality", "medium");
  form.set("n", "1");
  form.set(
    "size",
    width > height * 1.2
      ? "1536x1024"
      : height > width * 1.2
        ? "1024x1536"
        : "1024x1024",
  );
  form.set("output_format", "jpeg");
  form.set("output_compression", "85");
  let response: Response;
  try {
    response = await (dependencies.fetcher ?? fetch)(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(240_000),
      },
    );
  } catch {
    throw new DesignError(
      "Your photo preview took too long or could not connect. Please try again.",
      504,
    );
  }
  if (!response.ok) {
    if (response.status === 401)
      throw new DesignError(
        "Image generation is not configured correctly. The site owner needs to check the API key.",
        503,
      );
    if (response.status === 403)
      throw new DesignError(
        "This AI account does not have access to image editing. The site owner needs to check model access and organization verification.",
        503,
      );
    if (response.status === 429)
      throw new DesignError(
        "Image generation is busy or the AI account has reached its usage limit. Please try again later.",
        429,
      );
    throw new DesignError(
      "We could not create this photo preview. Please try again with a different description or photo.",
    );
  }
  const data: unknown = await response.json();
  const encoded = (data as { data?: { b64_json?: unknown }[] })?.data?.[0]
    ?.b64_json;
  if (typeof encoded !== "string" || !encoded || encoded.length > 25_000_000)
    throw new DesignError(
      "The image service did not return a usable preview. Please try again.",
    );
  try {
    // Normalize both sides to the source frame so comparison cannot independently crop the images.
    const rendered = await sharp(Buffer.from(encoded, "base64"), {
      limitInputPixels: 24_000_000,
    })
      .resize(width, height, { fit: "fill" })
      .jpeg({ quality: 85 })
      .toBuffer();
    return {
      originalImage: input.originalImage,
      generatedImage: `data:image/jpeg;base64,${rendered.toString("base64")}`,
      mode: "ai" as const,
    };
  } catch {
    throw new DesignError(
      "The image service returned an unreadable preview. Please try again.",
    );
  }
}
