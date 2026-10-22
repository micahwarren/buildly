import { checkImageLimit } from "@/lib/image-rate-limit";
import { NextResponse } from "next/server";
import { createDesign, DesignError } from "@/lib/services/image-design";
import { readProjectRequest } from "@/lib/project-request";
import { makeDemo } from "@/lib/project";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const { input, demo } = await readProjectRequest(req);
    checkImageLimit(req, demo);
    const design = await createDesign(makeDemo(input), demo);
    return NextResponse.json({
      generatedImage: design.generatedImage,
      visualizationMode: design.mode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "We could not create another design. Please try again.",
      },
      { status: error instanceof DesignError ? error.status : 500 },
    );
  }
}
