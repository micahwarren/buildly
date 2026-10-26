import { billed } from "@/lib/billing/server";
import { NextResponse } from "next/server";
import { readProjectRequest } from "@/lib/project-request";
import { makeDemo } from "@/lib/project";
import { refineProject } from "@/lib/services/refine-project";
import { DesignError } from "@/lib/services/image-design";
import { checkImageLimit } from "@/lib/image-rate-limit";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const { input } = await readProjectRequest(req.clone());
    const data = await req.json();
    if (
      typeof data.change !== "string" ||
      !data.change.trim() ||
      data.change.length > 1000 ||
      typeof data.generatedImage !== "string" ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(
        data.generatedImage,
      ) ||
      data.generatedImage.length > 3500000 ||
      typeof data.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(data.id)
    )
      throw new DesignError(
        "Open a saved design and describe your change in under 1,000 characters.",
        400,
      );
    checkImageLimit(req, false);
    return NextResponse.json(
      await billed(req, "design", data.id, () =>
        refineProject(
          {
            ...makeDemo(input),
            id: data.id,
            title:
              typeof data.title === "string"
                ? data.title.slice(0, 200)
                : "My revised project",
            generatedImage: data.generatedImage,
          },
          data.change.trim(),
        ),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "The revision could not be completed. Your previous version is unchanged.",
      },
      { status: error instanceof DesignError ? error.status : 500 },
    );
  }
}
