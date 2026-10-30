import type { SupabaseClient } from "@supabase/supabase-js";
import { removeProjectFiles } from "./projects";
export async function cleanupDeletedProjects(
  db: SupabaseClient,
  user?: string,
) {
  let query = db
    .from("projects")
    .select("id,user_id")
    .not("deleted_at", "is", null)
    .limit(20);
  if (user) query = query.eq("user_id", user);
  const { data, error } = await query;
  if (error) throw error;
  let complete = 0,
    pending = 0;
  for (const p of data || []) {
    try {
      await removeProjectFiles(db, p.user_id, p.id);
      const removed = await db
        .from("projects")
        .delete()
        .eq("id", p.id)
        .eq("user_id", p.user_id)
        .not("deleted_at", "is", null);
      if (removed.error) throw removed.error;
      complete++;
    } catch {
      pending++;
    }
  }
  return { complete, pending };
}

// Only orphan folders tied to failed generation requests are eligible automatically.
// Unknown legacy folders are preserved for manual review.
export async function cleanupFailedUploads(db: SupabaseClient) {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const { data, error } = await db
    .from("buildly_jobs")
    .select("id,user_id")
    .in("kind", ["design", "refine"])
    .in("state", ["failed", "interrupted"])
    .is("result_id", null)
    .lt("created_at", cutoff)
    .or("failure_code.is.null,failure_code.neq.files_cleaned")
    .limit(10);
  if (error) throw error;
  let removed = 0;
  for (const job of data || []) {
    const refs = await db
      .from("projects")
      .select("payload")
      .eq("user_id", job.user_id);
    if (refs.error) continue;
    if (
      (refs.data || []).some((row) =>
        JSON.stringify(row.payload).includes(
          `storage:${job.user_id}/${job.id}/`,
        ),
      )
    )
      continue;
    try {
      await removeProjectFiles(db, job.user_id, job.id);
      const result = await db
        .from("buildly_jobs")
        .update({ failure_code: "files_cleaned" })
        .eq("id", job.id)
        .eq("user_id", job.user_id);
      if (!result.error) removed++;
    } catch {}
  }
  return removed;
}
