import { authenticatedUser } from "@/lib/billing/server";
import { DesignError } from "@/lib/services/image-design";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { db, user } = await authenticatedUser(req);
    // Tombstones are hidden by client RLS. Count only the caller's records here.
    const { count, error } = await db
      .from("projects")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id)
      .not("deleted_at", "is", null);
    if (error || count === null)
      throw new DesignError(
        "Photo deletion status could not load. Please try again.",
        503,
      );
    return Response.json({ pending: count }, { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DesignError
            ? error.message
            : "Photo deletion status could not load.",
      },
      { status: error instanceof DesignError ? error.status : 503, headers },
    );
  }
}
