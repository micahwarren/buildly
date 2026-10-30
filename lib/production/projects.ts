import sharp from "sharp";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "../project";
import { DesignError } from "../services/image-design";
export function ownedImagePath(value: string, user: string) {
  const prefix = `storage:${user}/`;
  if (!value.startsWith(prefix))
    throw new DesignError(
      "A saved photo is not available to this account.",
      403,
    );
  const parts = value.slice(prefix.length).split("/");
  if (
    parts.length !== 2 ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(parts[0]) ||
    !/^[a-zA-Z0-9._-]{1,160}$/.test(parts[1]) ||
    [".", ".."].includes(parts[1])
  )
    throw new DesignError("The saved photo path is invalid.", 400);
  return value.slice(8);
}
export async function ownedProject(
  db: SupabaseClient,
  user: string,
  id: string,
) {
  const { data, error } = await db
    .from("projects")
    .select("payload")
    .eq("user_id", user)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error)
    throw new DesignError("Your project could not load. Try again.", 503);
  if (!data) throw new DesignError("This project could not be found.", 404);
  return { ...data.payload, id } as Project;
}
export async function loadProjectImages(
  db: SupabaseClient,
  user: string,
  p: Project,
) {
  async function image(value: string) {
    if (value.startsWith("data:image/")) return value;
    const path = ownedImagePath(value, user);
    const { data, error } = await db.storage
      .from("project-images")
      .download(path);
    if (error || !data)
      throw new DesignError("A saved photo could not load. Try again.", 503);
    return `data:${data.type || "image/jpeg"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }
  return {
    ...p,
    originalImage: await image(p.originalImage),
    generatedImage: await image(p.generatedImage),
    referenceImages: await Promise.all((p.referenceImages || []).map(image)),
    materialImages: await Promise.all((p.materialImages || []).map(image)),
  };
}
const uploadCache = new WeakMap<SupabaseClient, Map<string, string>>();
export async function persistProject(
  db: SupabaseClient,
  user: string,
  p: Project,
) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(p.id))
    throw new DesignError("Invalid project identifier.", 400);
  const payload = {
    ...p,
    referenceImages: [...(p.referenceImages || [])],
    materialImages: [...(p.materialImages || [])],
  };
  async function image(value: string, kind: string) {
    if (value.startsWith("storage:")) {
      ownedImagePath(value, user);
      return value;
    }
    const match =
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
        value,
      );
    if (!match)
      throw new DesignError("A design image could not be saved.", 503);
    let cache = uploadCache.get(db);
    if (!cache) {
      cache = new Map();
      uploadCache.set(db, cache);
    }
    const cacheKey = `${user}/${p.id}/${kind}/${createHash("sha256").update(value).digest("hex")}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const bytes = await sharp(Buffer.from(match[2], "base64"), {
      limitInputPixels: 24_000_000,
    })
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();
    const digest = createHash("sha256")
      .update(bytes)
      .digest("hex")
      .slice(0, 24);
    const path = `${user}/${p.id}/${kind}-${digest}.jpg`;
    const { error } = await db.storage
      .from("project-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error)
      throw new DesignError(
        "Your design could not save. Check your projects before generating again.",
        503,
      );
    cache.set(cacheKey, `storage:${path}`);
    return `storage:${path}`;
  }
  const [original, generated, references, materials] = await Promise.all([
    image(payload.originalImage, "original"),
    image(payload.generatedImage, "design"),
    Promise.all(
      payload.referenceImages!.map((value, i) =>
        image(value, `referenceImages-${i}`),
      ),
    ),
    Promise.all(
      payload.materialImages!.map((value, i) =>
        image(value, `materialImages-${i}`),
      ),
    ),
  ]);
  payload.originalImage = original;
  payload.generatedImage = generated;
  payload.referenceImages = references;
  payload.materialImages = materials;
  const { error } = await db.from("projects").upsert(
    {
      id: p.id,
      user_id: user,
      payload,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: "user_id,id" },
  );
  if (error)
    throw new DesignError(
      "Your design could not save. Check your projects before generating again.",
      503,
    );
  return payload;
}
export async function removeProjectFiles(
  db: SupabaseClient,
  user: string,
  id: string,
) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw new DesignError("Invalid project.", 400);
  const prefix = `${user}/${id}`;
  const bucket = db.storage.from("project-images");
  for (let page = 0; page < 1000; page++) {
    const { data, error } = await bucket.list(prefix, { limit: 100 });
    if (error) throw error;
    if (!data?.length) return;
    const files = data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
    if (!files.length) throw new Error("Unexpected project storage folder");
    const removed = await bucket.remove(files);
    if (removed.error) throw removed.error;
  }
  throw new Error("Project cleanup needs another pass");
}
