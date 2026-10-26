import { authenticatedUser } from "@/lib/billing/server";
import { DesignError } from "@/lib/services/image-design";
export const maxDuration = 120;
export async function DELETE(req: Request) {
  try {
    const { db, user } = await authenticatedUser(req);
    const access = await db
      .from("buildly_reservations")
      .select("id")
      .eq("user_id", user.id)
      .eq("state", "pending")
      .gte("created_at", new Date(Date.now() - 600000).toISOString())
      .limit(1);
    if (access.data?.length)
      throw new DesignError(
        "Wait for your current generation to finish before deleting your account.",
        409,
      );
    const bucket = db.storage.from("project-images");
    async function empty(prefix: string): Promise<void> {
      // Always delete page zero, so removing files cannot skip subsequent pages.
      for (;;) {
        const { data, error } = await bucket.list(prefix, { limit: 100 });
        if (error) throw error;
        if (!data?.length) return;
        const files: string[] = [];
        for (const item of data) {
          if (item.id) files.push(`${prefix}/${item.name}`);
          else await empty(`${prefix}/${item.name}`);
        }
        if (files.length) {
          const { error } = await bucket.remove(files);
          if (error) throw error;
        }
      }
    }
    await empty(user.id);
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return Response.json({ deleted: true });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof DesignError
            ? e.message
            : "Account deletion could not finish. Please retry.",
      },
      { status: e instanceof DesignError ? e.status : 503 },
    );
  }
}
