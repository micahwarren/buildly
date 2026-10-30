import { timingSafeEqual } from "node:crypto";
import { adminClient, authenticatedUser } from "@/lib/billing/server";
import {
  cleanupDeletedProjects,
  cleanupFailedUploads,
} from "@/lib/production/cleanup";
export const maxDuration = 120;
function authorizedMaintenance(req: Request) {
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const expected = process.env.BUILDLY_MAINTENANCE_TOKEN;
  return (
    !!expected &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
export async function GET(req: Request) {
  // Vercel Cron sends GET with CRON_SECRET as the bearer token. Anonymous GET
  // must never fall through to account-scoped cleanup or touch the database.
  if (!authorizedMaintenance(req))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return POST(req);
}
export async function POST(req: Request) {
  try {
    if (authorizedMaintenance(req)) {
      const db = adminClient();
      const expired = await db
        .from("buildly_jobs")
        .update({ state: "interrupted", updated_at: new Date().toISOString() })
        .in("state", ["running", "image_saved"])
        .lt("expires_at", new Date().toISOString());
      if (expired.error) throw expired.error;
      const result = await cleanupDeletedProjects(db);
      const failedUploads = await cleanupFailedUploads(db);
      // Only old completed/failed history is pruned; saved projects are unaffected.
      const old = new Date(Date.now() - 30 * 86400000).toISOString();
      const prunedJobs = await db
        .from("buildly_jobs")
        .delete()
        .lt("created_at", old)
        .is("result_id", null)
        .in("state", ["complete", "failed", "interrupted"])
        // Keep failed image operations until their orphan files were cleaned.
        .or("kind.eq.plan,failure_code.eq.files_cleaned");
      if (prunedJobs.error) throw prunedJobs.error;
      const prunedReports = await db
        .from("buildly_diagnostics")
        .delete()
        .lt("created_at", old);
      if (prunedReports.error) throw prunedReports.error;
      return Response.json({ ...result, failedUploads });
    }
    const { db, user } = await authenticatedUser(req);
    return Response.json(await cleanupDeletedProjects(db, user.id));
  } catch {
    return Response.json(
      { error: "Cleanup could not finish. Please try again." },
      { status: 503 },
    );
  }
}
