import { planProject } from "@/lib/services/project-planning";
import { readProjectRequest } from "@/lib/project-request";
import { executeJob } from "@/lib/production/jobs";
import { DesignError } from "@/lib/services/image-design";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const raw = await req.clone().text();
    if (raw.length > 4_400_000)
      throw new DesignError("Please use smaller photos.", 413);
    if (JSON.parse(raw).mode === "demo") {
      const { input } = await readProjectRequest(req);
      return Response.json(await planProject(input, true));
    }
    const result = await executeJob(req, "design", false);
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
