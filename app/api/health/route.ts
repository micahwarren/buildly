import { adminClient } from "@/lib/billing/server";
import { imageProviderConfig } from "@/lib/image-provider";
export const runtime = "nodejs";
export const maxDuration = 10;
export async function GET() {
  let database = false;
  try {
    const result = await adminClient()
      .from("buildly_jobs")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(5000));
    database = !result.error;
  } catch {}
  const generationEnabled = process.env.BUILDLY_GENERATION_ENABLED !== "false";
  return Response.json(
    {
      service: "buildly",
      version: "non-payment-release-v1",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      status: database
        ? generationEnabled && imageProviderConfig().apiKey
          ? "ok"
          : "degraded"
        : "unavailable",
      database,
      generationEnabled,
    },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
    },
  );
}
