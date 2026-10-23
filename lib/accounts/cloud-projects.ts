import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "../project";
const bucket = "project-images";
async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new Error("Please sign in again to save to your account.");
  return data.user.id;
}
async function storeImage(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  kind: string,
  image: string,
) {
  if (!image.startsWith("data:")) {
    if (/^\/images\/[a-z-]+\.svg$/.test(image)) return image;
    throw new Error("This project image could not be saved.");
  }
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw new Error("This image format could not be saved.");
  const raw = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  if (raw.length > 10 * 1024 * 1024)
    throw new Error("This project image is too large to sync.");
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", raw)),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  const path = `${userId}/${projectId}/${kind}-${digest}.${match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1]}`;
  const storage = client.storage.from(bucket);
  const folder = path.slice(0, path.lastIndexOf("/"));
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const existing = await storage.list(folder, { search: filename, limit: 10 });
  if (existing.error)
    throw new Error(
      "Private project storage is not available. Your local project is kept.",
    );
  if (!existing.data?.some((file) => file.name === filename)) {
    const { error } = await storage.upload(
      path,
      new Blob([raw], { type: match[1] }),
      { contentType: match[1], upsert: true },
    );
    if (error)
      throw new Error(
        "Your photo could not sync. Check that private project storage is set up.",
      );
  }
  return `storage:${path}`;
}
async function loadImage(client: SupabaseClient, image: string) {
  if (image.startsWith("/images/")) return image;
  if (!image.startsWith("storage:"))
    throw new Error("The saved photo reference is not valid.");
  const { data, error } = await client.storage
    .from(bucket)
    .download(image.slice(8));
  if (error) throw new Error("A saved project photo could not be downloaded.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Your saved photo could not be opened."));
    reader.readAsDataURL(data);
  });
}
export async function saveCloudProject(
  client: SupabaseClient,
  project: Project,
) {
  if (!/^[a-zA-Z0-9-]+$/.test(project.id))
    throw new Error("Project identifier is invalid.");
  const userId = await currentUser(client);
  const [originalImage, generatedImage] = await Promise.all([
    storeImage(client, userId, project.id, "original", project.originalImage),
    storeImage(client, userId, project.id, "design", project.generatedImage),
  ]);
  const { error } = await client.from("projects").upsert(
    {
      id: project.id,
      user_id: userId,
      payload: { ...project, originalImage, generatedImage },
      updated_at: project.updatedAt,
    },
    { onConflict: "user_id,id" },
  );
  if (error)
    throw new Error(
      "Cloud save failed. Your local copy is kept. Check that the project database is set up.",
    );
}
export async function readCloudProjects(client: SupabaseClient) {
  const userId = await currentUser(client);
  const { data, error } = await client
    .from("projects")
    .select("payload")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error)
    throw new Error(
      "Account projects could not load. Your local projects are kept. Check the database setup or connection.",
    );
  return Promise.all(
    (data || []).map(async (row) => {
      const project = row.payload as Project;
      return {
        ...project,
        originalImage: await loadImage(client, project.originalImage),
        generatedImage: await loadImage(client, project.generatedImage),
      };
    }),
  );
}
export async function deleteCloudProject(client: SupabaseClient, id: string) {
  const userId = await currentUser(client);
  const { error } = await client
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error)
    throw new Error(
      "This project could not be removed from your account. Please try again.",
    );
  // Old versioned image files are retained privately; storage lifecycle cleanup can remove orphans.
}
