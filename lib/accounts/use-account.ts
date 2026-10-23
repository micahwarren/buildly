"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getAccountClient } from "./client";
export function useAccount() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [recovery, setRecovery] = useState(false),
    [error, setError] = useState("");
  const client = getAccountClient();
  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let alive = true;
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error)
          setError("We could not restore your sign-in. Please sign in again.");
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setError(
            "Account services could not be reached. Your local projects are kept.",
          );
        }
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  return {
    client,
    session,
    user: session?.user || null,
    loading,
    recovery,
    setRecovery,
    error,
  };
}
export type AccountState = ReturnType<typeof useAccount>;
