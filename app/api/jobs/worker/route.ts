import { after } from "next/server";
import { sweepBackgroundWork } from "@/lib/production/job-queue";
import { workerAuthorization } from "@/lib/production/worker-authorization";
import { adminClient } from "@/lib/billing/server";
export const maxDuration = 300;
export const runtime = "nodejs";
export async function POST(req: Request) {
  const authorization = workerAuthorization(req.headers, process.env.SITEAI_JOB_WORKER_TOKEN);
  if (!authorization)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const claimed = await adminClient().rpc("siteai_worker_once", {
    p_nonce: authorization.nonce,
    p_sent: authorization.sent,
  });
  if (claimed.error)
    return Response.json({ error: "Worker is unavailable" }, { status: 503 });
  if (!claimed.data)
    return Response.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  after(async () => {
    await sweepBackgroundWork().catch(() =>
      console.warn("siteai_background_sweep_deferred"),
    );
  });
  return Response.json(
    { accepted: true },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
