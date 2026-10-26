import type { Project } from "./project";
export type ProjectDraft = {
  view: string;
  step: number;
  detail: number;
  photo: string;
  type: string;
  description: string;
  width: string;
  length: string;
  budget: string;
  experience: string;
  projectId?: string;
  details?: Project["details"];
};
let connection: Promise<IDBDatabase> | undefined;
function open() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("buildly", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("projects", { keyPath: "key" });
        db.createObjectStore("drafts");
        db.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
    });
  return connection;
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Storage interrupted"));
  });
}
export async function migrateLegacyProjects() {
  const done = await transaction("meta", "readonly", (s) => s.get("legacy-v1"));
  if (done) return;
  const legacy = localStorage.getItem("buildly-projects");
  const projects: Project[] = legacy ? JSON.parse(legacy) : [];
  if (!Array.isArray(projects))
    throw new Error("Saved project data is not readable.");
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["projects", "meta"], "readwrite");
    for (const project of projects) {
      if (project && typeof project.id === "string")
        tx.objectStore("projects").put({
          key: `guest:${project.id}`,
          scope: "guest",
          project,
        });
    }
    tx.objectStore("meta").put(true, "legacy-v1");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  // Keep the original localStorage entry intact as a recovery copy.
}
export async function readLocalProjects(scope: string): Promise<Project[]> {
  const records = await transaction<{ scope: string; project: Project }[]>(
    "projects",
    "readonly",
    (s) => s.getAll(),
  );
  return records
    .filter((r) => r.scope === scope)
    .map((r) => r.project)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function writeLocalProject(scope: string, project: Project) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    const key = `${scope}:${project.id}`;
    const existing = store.get(key);
    existing.onsuccess = () => {
      const previous = existing.result?.project as Project | undefined;
      if (!previous || previous.updatedAt <= project.updatedAt)
        store.put({ key, scope, project });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function removeLocalProject(scope: string, id: string) {
  await transaction("projects", "readwrite", (s) => s.delete(`${scope}:${id}`));
}
export async function readDraft(
  scope: string,
): Promise<ProjectDraft | undefined> {
  return transaction("drafts", "readonly", (s) => s.get(scope));
}
export async function writeDraft(scope: string, draft: ProjectDraft) {
  await transaction("drafts", "readwrite", (s) => s.put(draft, scope));
}
export async function clearAccountLocalData(scope: string) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["projects", "drafts"], "readwrite");
    const cursor = tx.objectStore("projects").openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        if (c.value.scope === scope) c.delete();
        c.continue();
      }
    };
    tx.objectStore("drafts").delete(scope);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
