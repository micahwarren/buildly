import { authenticatedUser } from "@/lib/billing/server";
import { DesignError } from "@/lib/services/image-design";
export async function PATCH(req: Request) {
  try {
    const { db, user } = await authenticatedUser(req);
    const raw = await req.text();
    if (raw.length > 2048)
      throw new DesignError("Invalid progress update.", 400);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new DesignError("Invalid progress update.", 400);
    }
    if (
      !body ||
      typeof body.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(body.id) ||
      !Number.isInteger(body.step) ||
      body.step < 0 ||
      body.step > 999 ||
      typeof body.title !== "string" ||
      body.title.length > 500 ||
      typeof body.done !== "boolean"
    )
      throw new DesignError("Invalid progress update.", 400);
    const result = await db.rpc("siteai_project_progress", {
      p_user: user.id,
      p_project: body.id,
      p_step: body.step,
      p_title: body.title,
      p_done: body.done,
    });
    if (result.error) {
      if (result.error.message.includes("PLAN_CHANGED"))
        throw new DesignError(
          "Your plan changed. Reload it before checking this step.",
          409,
        );
      if (result.error.message.includes("PROJECT_NOT_FOUND"))
        throw new DesignError("This project could not be found.", 404);
      if (result.error.message.includes("ACCOUNT_DELETING"))
        throw new DesignError("Your account deletion is in progress.", 409);
      throw result.error;
    }
    return Response.json(result.data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "Progress couldn’t save. Please try again.",
      },
      {
        status: error instanceof DesignError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
