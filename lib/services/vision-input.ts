import sharp from "sharp";
import { MAX_PLAN_IMAGE_CHARS } from "../image-limits";
import { DesignError } from "./image-design";
export async function photoPart(dataUrl: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl,
  );
  if (!match || dataUrl.length > MAX_PLAN_IMAGE_CHARS)
    throw new DesignError(
      "A saved original photo and generated design are required to build a matching plan.",
      400,
    );
  try {
    const data = await sharp(Buffer.from(match[2], "base64"), {
      limitInputPixels: 24_000_000,
    })
      .rotate()
      .resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    return {
      inlineData: { mimeType: "image/jpeg", data: data.toString("base64") },
    };
  } catch {
    throw new DesignError(
      "One of the project photos could not be read. Your saved project has not been changed.",
      400,
    );
  }
}
