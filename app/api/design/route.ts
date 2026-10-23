import { checkImageLimit } from "@/lib/image-rate-limit";
import { NextResponse } from "next/server";
import { DesignError } from "@/lib/services/image-design";
import { readProjectRequest } from "@/lib/project-request";
import { planProject } from "@/lib/services/project-planning";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const { input, demo } = await readProjectRequest(req);
    checkImageLimit(req, demo);
    return NextResponse.json(await planProject(input, demo));
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
