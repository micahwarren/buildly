import { NextResponse } from "next/server";
import { readProjectRequest } from "@/lib/project-request";
import { makeDemo } from "@/lib/project";
import { checkChatLimit } from "@/lib/chat-rate-limit";
import { DesignError } from "@/lib/services/image-design";
import { createDesignPlan } from "@/lib/services/design-plan";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const { input } = await readProjectRequest(req.clone());
    const data = await req.json();
    if (
      typeof data.generatedImage !== "string" ||
      data.generatedImage.length > 4_000_000
    )
      throw new DesignError("A saved design image is required.", 400);
    checkChatLimit(req);
    return NextResponse.json(
      await createDesignPlan({
        ...makeDemo(input),
        generatedImage: data.generatedImage,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "We could not rebuild the plan. Your saved project is unchanged.",
      },
      { status: error instanceof DesignError ? error.status : 500 },
    );
  }
}
