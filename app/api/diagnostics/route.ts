import { authenticatedUser } from "@/lib/billing/server";
export async function POST(req: Request) {
  try {
    if (Number(req.headers.get("content-length")) > 1024)
      return new Response(null, { status: 413 });
    const { db, user } = await authenticatedUser(req);
    if (user.user_metadata.diagnostics_allowed !== true)
      return new Response(null, { status: 403 });
    const text = await req.text();
    if (text.length > 1024) return new Response(null, { status: 413 });
    const value = JSON.parse(text);
    if (
      !["screen_error", "connection_error"].includes(value.code) ||
      !["ios", "android", "web"].includes(value.platform) ||
      typeof value.release !== "string" ||
      !/^[a-zA-Z0-9.() -]{1,40}$/.test(value.release) ||
      typeof value.fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.fingerprint)
    )
      return new Response(null, { status: 400 });
    const { error } = await db.rpc("buildly_report_diagnostic", {
      p_user: user.id,
      p_code: value.code,
      p_platform: value.platform,
      p_release: value.release,
      p_fingerprint: value.fingerprint,
    });
    return new Response(null, { status: error ? 503 : 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
