import { authenticatedUser } from "@/lib/billing/server";
import { DesignError } from "@/lib/services/image-design";
export async function GET(req: Request) {
  try {
    const { db, user } = await authenticatedUser(req);
    const query = new URL(req.url).searchParams;
    const id = query.get("id");
    if (id && !/^[a-zA-Z0-9-]{1,80}$/.test(id))
      throw new DesignError("Invalid project.", 400);
    const limit = Number(query.get("limit") || 20),
      offset = Number(query.get("offset") || 0);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000
    )
      throw new DesignError("Invalid project page.", 400);
    const result = await db.rpc("siteai_project_catalog", {
      p_user: user.id,
      p_limit: limit,
      p_offset: offset,
      p_project: id,
    });
    if (result.error) throw result.error;
    return Response.json(result.data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "Your projects could not load. Try again.",
      },
      { status: error instanceof DesignError ? error.status : 503 },
    );
  }
}
