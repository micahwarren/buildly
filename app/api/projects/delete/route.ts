import { authenticatedUser } from "@/lib/billing/server";
import { removeProjectFiles } from "@/lib/production/projects";
import { DesignError } from "@/lib/services/image-design";
export const maxDuration = 120;
export async function DELETE(req: Request) {
  try {
    const { db, user } = await authenticatedUser(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^[a-zA-Z0-9-]{1,80}$/.test(id))
      throw new DesignError("Invalid project.", 400);
    const mark = await db.rpc("buildly_mark_project_deleted", {
      p_user: user.id,
      p_project: id,
    });
    if (mark.error) {
      const { jobError } = await import("@/lib/production/errors");
      throw jobError(mark.error.message);
    }
    if (mark.data) {
      await removeProjectFiles(db, user.id, id);
      const removed = await db
        .from("projects")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (removed.error) throw removed.error;
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "Project deletion is unfinished. Retry to finish removing its photos.",
      },
      { status: error instanceof DesignError ? error.status : 503 },
    );
  }
}
