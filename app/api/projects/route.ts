import { billed } from "@/lib/billing/server";
import { checkImageLimit } from "@/lib/image-rate-limit";
import { NextResponse } from "next/server";
import { planProject } from "@/lib/services/project-planning";
import { DesignError } from "@/lib/services/image-design";
import { readProjectRequest } from "@/lib/project-request";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const { input, demo } = await readProjectRequest(req);
    checkImageLimit(req, demo);
    const id = crypto.randomUUID();
    return NextResponse.json(
      await billed(
        req,
        "design",
        id,
        () => planProject({ ...input, id }, demo),
        demo,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "We could not prepare your project. Please try again.",
      },
      { status: error instanceof DesignError ? error.status : 500 },
    );
  }
}
