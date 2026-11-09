import type { SupabaseClient } from "@supabase/supabase-js";
import { DesignError } from "../services/image-design";
type Version = {
  id: string;
  parentProjectId?: string;
  createdAt: string;
};
export function orderedVersions(versions: Version[], family: string) {
  const pending = [...versions].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const ids = new Set(pending.map((v) => v.id)),
    done = new Set<string>(),
    ordered: Version[] = [];
  while (pending.length) {
    let index = pending.findIndex((v) => v.id === family);
    if (index < 0)
      index = pending.findIndex(
        (v) =>
          !v.parentProjectId ||
          !ids.has(v.parentProjectId) ||
          done.has(v.parentProjectId),
      );
    const [version] = pending.splice(index < 0 ? 0 : index, 1);
    ordered.push(version);
    done.add(version.id);
  }
  let revision = 0;
  return ordered.map((v) => ({
    ...v,
    label:
      v.id === family && !v.parentProjectId
        ? "Original"
        : `Revision ${++revision}`,
  }));
}
export async function projectHistory(
  db: SupabaseClient,
  user: string,
  id: string,
) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw new DesignError("Invalid project.", 400);
  const catalog = await db.rpc("siteai_project_catalog", {
    p_user: user,
    p_limit: 1,
    p_offset: 0,
    p_project: id,
  });
  if (catalog.error)
    throw new DesignError(
      "Your project versions couldn’t load. Try again.",
      503,
    );
  const family = catalog.data?.projects?.[0];
  if (
    !family ||
    !Array.isArray(family.familyMembers) ||
    !family.familyMembers.length
  )
    throw new DesignError("This project could not be found.", 404);
  const { data, error } = await db
    .from("projects")
    .select("id,payload,updated_at")
    .eq("user_id", user)
    .is("deleted_at", null)
    .in("id", family.familyMembers.slice(0, 100))
    .limit(100);
  if (error || !data)
    throw new DesignError(
      "Your project versions couldn’t load. Try again.",
      503,
    );
  return {
    familyId: family.familyId as string,
    latestId: family.id as string,
    versions: orderedVersions(
      data.map((row) => ({
        id: row.id as string,
        parentProjectId: row.payload?.parentProjectId as string | undefined,
        createdAt:
          typeof row.payload?.createdAt === "string"
            ? row.payload.createdAt
            : row.updated_at || "",
      })),
      family.familyId,
    ),
  };
}
