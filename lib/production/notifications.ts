import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
type Delivery = {
  jobId: string;
  projectId: string;
  userId: string;
  deviceHash: string;
  token: string;
  attempt: number;
};
export async function notifyReady(
  db: SupabaseClient,
  user: string,
  job: string,
  project: string,
) {
  const result = await db.rpc("siteai_notify_ready", {
    p_user: user,
    p_id: job,
    p_project: project,
  });
  if (result.error) throw Error("Completion notification could not queue");
}
async function expo(path: string, body: object, request: typeof fetch) {
  const response = await request("https://exp.host/--/api/v2/push/" + path, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(process.env.EXPO_PUSH_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw Error("Notification provider is unavailable");
  const data = await response.json();
  if (data.errors) throw Error("Notification provider rejected the batch");
  return data.data;
}
export async function deliverNotifications(
  db: SupabaseClient,
  request: typeof fetch = fetch,
) {
  const lease = randomUUID();
  const claimed = await db.rpc("siteai_claim_push", { p_lease: lease });
  if (claimed.error) throw Error("Notification queue could not load");
  const rows = (claimed.data || []) as Delivery[];
  if (rows.length) {
    let tickets;
    try {
      tickets = await expo(
        "send",
        rows.map((row) => ({
          to: row.token,
          title: "Your project is ready! 🎉",
          body: "Your design, materials and plan are ready to explore! 🛠️",
          sound: "default",
          channelId: "project-ready",
          data: {
            type: "project-ready",
            jobId: row.jobId,
            projectId: row.projectId,
            userId: row.userId,
          },
        })),
        request,
      );
    } catch {
      tickets = [];
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i],
        ticket = tickets[i];
      const code = ticket?.details?.error;
      const accepted = ticket?.status === "ok" && typeof ticket.id === "string";
      const invalid = [
        "DeviceNotRegistered",
        "InvalidCredentials",
        "MismatchSenderId",
      ].includes(code);
      const values = accepted
        ? {
            state: "accepted",
            ticket: ticket.id,
            due_at: new Date(Date.now() + 15 * 60000).toISOString(),
            lease: null,
          }
        : {
            state: invalid || row.attempt >= 4 ? "failed" : "pending",
            error_code:
              typeof code === "string"
                ? code.slice(0, 80)
                : "provider_unavailable",
            due_at: new Date(Date.now() + 60_000 * row.attempt).toISOString(),
            lease: null,
          };
      await db
        .from("siteai_push_outbox")
        .update(values)
        .eq("job_id", row.jobId)
        .eq("device_hash", row.deviceHash)
        .eq("lease", lease);
      if (code === "DeviceNotRegistered")
        await db
          .from("siteai_push_devices")
          .update({ enabled: false })
          .eq("token_hash", row.deviceHash)
          .eq("user_id", row.userId);
      if (invalid) console.warn("siteai_push_delivery", { code });
    }
  }
  const accepted = await db
    .from("siteai_push_outbox")
    .select("job_id,device_hash,user_id,ticket,created_at")
    .eq("state", "accepted")
    .lte("due_at", new Date().toISOString())
    .limit(100);
  if (accepted.error || !accepted.data?.length) return;
  let receipts;
  try {
    receipts = await expo(
      "getReceipts",
      { ids: accepted.data.map((row) => row.ticket) },
      request,
    );
  } catch {
    await db
      .from("siteai_push_outbox")
      .update({ due_at: new Date(Date.now() + 5 * 60000).toISOString() })
      .eq("state", "accepted")
      .lte("due_at", new Date().toISOString());
    return;
  }
  for (const row of accepted.data) {
    const result = receipts?.[row.ticket];
    const expired = Date.parse(row.created_at) < Date.now() - 86400000;
    const code = result?.details?.error;
    await db
      .from("siteai_push_outbox")
      .update({
        state:
          result?.status === "ok"
            ? "sent"
            : result?.status === "error" || expired
              ? "failed"
              : "accepted",
        error_code: typeof code === "string" ? code.slice(0, 80) : null,
        due_at: new Date(Date.now() + 5 * 60000).toISOString(),
      })
      .eq("job_id", row.job_id)
      .eq("device_hash", row.device_hash)
      .eq("state", "accepted");
    if (code === "DeviceNotRegistered")
      await db
        .from("siteai_push_devices")
        .update({ enabled: false })
        .eq("token_hash", row.device_hash)
        .eq("user_id", row.user_id);
  }
}
