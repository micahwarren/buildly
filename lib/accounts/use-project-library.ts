"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../project";
import type { AccountState } from "./use-account";
import {
  migrateLegacyProjects,
  readLocalProjects,
  writeLocalProject,
  removeLocalProject,
} from "../local-projects";
import {
  readCloudProjects,
  saveCloudProject,
  deleteCloudProject,
} from "./cloud-projects";
function merge(projects: Project[], incoming: Project[]) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  for (const p of incoming) {
    const previous = byId.get(p.id);
    if (!previous || p.updatedAt >= previous.updatedAt) byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
export function useProjectLibrary(account: AccountState) {
  const userId = account.user?.id;
  const scope = userId || "guest";
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [saved, setSaved] = useState<Project[]>([]),
    [ready, setReady] = useState(false),
    [loadedScope, setLoadedScope] = useState(""),
    [warning, setWarning] = useState(""),
    [saving, setSaving] = useState(0),
    [synced, setSynced] = useState<Set<string>>(new Set()),
    [guestCount, setGuestCount] = useState(0);
  const queue = useRef(new Map<string, Promise<unknown>>());
  useEffect(() => {
    if (account.loading) return;
    let cancelled = false;
    setReady(false);
    setWarning("");
    setSynced(new Set());
    async function load() {
      try {
        await migrateLegacyProjects();
        const local = await readLocalProjects(scope);
        const guests = await readLocalProjects("guest");
        if (cancelled) return;
        setSaved(local);
        setGuestCount(guests.length);
        setLoadedScope(scope);
        setReady(true);
        if (account.client && userId) {
          const cloud = await readCloudProjects(account.client);
          if (cancelled) return;
          const latestLocal = await readLocalProjects(scope);
          const combined = merge(latestLocal, cloud);
          await Promise.all(combined.map((p) => writeLocalProject(scope, p)));
          if (cancelled) return;
          setSaved((current) => merge(current, combined));
          setSynced(
            new Set(
              cloud
                .filter(
                  (p) =>
                    !latestLocal.some(
                      (l) => l.id === p.id && l.updatedAt > p.updatedAt,
                    ),
                )
                .map((p) => p.id),
            ),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setWarning(
            e instanceof Error
              ? e.message
              : "Your saved projects could not load.",
          );
          setLoadedScope(scope);
          setReady(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [account.loading, account.client, userId, scope]);
  const save = useCallback(
    async (project: Project): Promise<"cloud" | "device" | "failed"> => {
      const key = `${scope}:${project.id}`;
      const previous = queue.current.get(key) || Promise.resolve();
      let local = false;
      // Local durability must not wait behind an earlier slow cloud request.
      const localWrite = writeLocalProject(scope, project)
        .then(() => {
          local = true;
          if (activeScope.current === scope)
            setSaved((current) => merge(current, [project]));
        })
        .catch(() => {});
      const operation = previous
        .catch(() => {})
        .then(async () => {
          if (activeScope.current === scope) {
            setSaving((v) => v + 1);
            setSynced((current) => {
              const next = new Set(current);
              next.delete(project.id);
              return next;
            });
          }
          try {
            await localWrite;
            if (account.client && userId) {
              await saveCloudProject(account.client, project);
              if (activeScope.current === scope) {
                setSaved((current) => merge(current, [project]));
                setSynced((current) => new Set([...current, project.id]));
                setWarning("");
              }
              return "cloud" as const;
            }
            if (!local)
              throw new Error(
                "This device could not save the project. Download a backup before leaving.",
              );
            if (activeScope.current === scope) setWarning("");
            return "device" as const;
          } catch (e) {
            if (activeScope.current === scope)
              setSynced((current) => {
                const next = new Set(current);
                next.delete(project.id);
                return next;
              });
            if (activeScope.current === scope)
              setWarning(
                local
                  ? "Cloud saving failed. Your project is saved on this device; please try again."
                  : e instanceof Error
                    ? e.message
                    : "Saving failed. Download a backup before leaving.",
              );
            return local ? ("device" as const) : ("failed" as const);
          } finally {
            if (activeScope.current === scope)
              setSaving((v) => Math.max(0, v - 1));
          }
        });
      queue.current.set(key, operation);
      return operation;
    },
    [scope, account.client, userId],
  );
  async function remove(id: string) {
    try {
      await queue.current.get(`${scope}:${id}`);
      if (account.client && userId)
        await deleteCloudProject(account.client, id);
      await removeLocalProject(scope, id);
      setSaved((current) => current.filter((p) => p.id !== id));
      setSynced((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return true;
    } catch (e) {
      setWarning(
        e instanceof Error ? e.message : "Your project could not be removed.",
      );
      return false;
    }
  }
  async function importGuests() {
    if (!account.user) return;
    const guests = await readLocalProjects("guest");
    for (const project of guests) await save(project);
  }
  return {
    scope,
    saved,
    ready: ready && loadedScope === scope,
    warning,
    saving: saving > 0,
    synced,
    guestCount,
    save,
    remove,
    importGuests,
  };
}
