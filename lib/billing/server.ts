import { createClient } from "@supabase/supabase-js";
import { DesignError } from "../services/image-design";
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new DesignError("Account services are not configured.", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function authenticatedUser(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new DesignError("Sign in to continue.", 401);
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new DesignError("Please sign in again.", 401);
  return { db, user: data.user };
}
export async function reservePurchase(
  req: Request,
  kind: "design" | "plan" | "chat",
  projectId: string,
  demo = false,
) {
  if (process.env.BILLING_ENABLED !== "true" || demo)
    return { finish: async () => {} };
  if (typeof projectId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(projectId))
    throw new DesignError("Open a saved project first.", 400);
  const { db, user } = await authenticatedUser(req);
  const { data, error } = await db.rpc("buildly_reserve", {
    p_user: user.id,
    p_project: projectId,
    p_kind: kind,
  });
  if (error) {
    if (/PAYMENT_REQUIRED/.test(error.message))
      throw new DesignError(
        "Purchase a project to generate your design and plan.",
        402,
      );
    if (/REVISIONS_USED/.test(error.message))
      throw new DesignError(
        "All three included design revisions have been used. Start a new project to create another design.",
        409,
      );
    if (/REQUEST_IN_PROGRESS/.test(error.message))
      throw new DesignError(
        "Another request is still running. Wait for it to finish before trying again.",
        409,
      );
    if (/DAILY_LIMIT/.test(error.message))
      throw new DesignError(
        "Daily request limit reached. Try again tomorrow.",
        429,
      );
    throw new DesignError(
      "Purchase access could not be checked. Please try again.",
      503,
    );
  }
  return {
    finish: async (success: boolean, result?: string) => {
      const { error } = await db.rpc("buildly_finish", {
        p_user: user.id,
        p_reservation: data,
        p_success: success,
        p_result: result || null,
      });
      if (error)
        console.error("buildly_billing_finalize_failed", {
          reservation: data,
          success,
        });
    },
  };
}
export async function billed<T extends { id?: string }>(
  req: Request,
  kind: "design" | "plan" | "chat",
  projectId: string,
  work: () => Promise<T>,
  demo = false,
): Promise<T> {
  const reservation = await reservePurchase(req, kind, projectId, demo);
  try {
    const result = await work();
    await reservation.finish(true, result.id);
    return result;
  } catch (error) {
    await reservation.finish(false);
    throw error;
  }
}
