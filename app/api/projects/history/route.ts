import { authenticatedUser } from "@/lib/billing/server";
import { projectHistory } from "@/lib/production/project-history";
import { DesignError } from "@/lib/services/image-design";
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { db, user } = await authenticatedUser(req);
    const id = new URL(req.url).searchParams.get("id") || "";
    return Response.json(await projectHistory(db, user.id, id), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "Your project versions couldn’t load. Try again.",
      },
      { status: error instanceof DesignError ? error.status : 503, headers },
    );
  }
}
