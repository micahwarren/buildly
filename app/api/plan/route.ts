import { executeJob } from "@/lib/production/jobs";
import { DesignError } from "@/lib/services/image-design";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const result = await executeJob(req, "plan", false);
    if (!result.project)
      return Response.json(
        {
          error: "This request is still processing. Check your projects.",
          jobId: result.jobId,
        },
        { status: 409 },
      );
    return Response.json(result.project);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "Your request could not finish. Check your projects before trying again.",
      },
      { status: error instanceof DesignError ? error.status : 503 },
    );
  }
}
