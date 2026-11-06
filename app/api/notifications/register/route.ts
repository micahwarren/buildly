import { createHash } from "node:crypto";
import { authenticatedUser } from "@/lib/billing/server";
import { DesignError } from "@/lib/services/image-design";
async function handle(req: Request, remove = false) {
  try {
    const { db, user } = await authenticatedUser(req);
    const text = await req.text();
    if (text.length > 1024)
      throw new DesignError("Notification settings are invalid.", 400);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new DesignError("Notification settings are invalid.", 400);
    }
    if (
      typeof body?.token !== "string" ||
      !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{16,255}\]$/.test(
        body.token,
      )
    )
      throw new DesignError("Notification settings are invalid.", 400);
    if (!remove && !["ios", "android"].includes(body.platform))
      throw new DesignError("Notification settings are invalid.", 400);
    const hash = createHash("sha256").update(body.token).digest("hex");
    const result = remove
      ? await db
          .from("siteai_push_devices")
          .delete()
          .eq("token_hash", hash)
          .eq("user_id", user.id)
      : await db.rpc("siteai_register_push", {
          p_user: user.id,
          p_hash: hash,
          p_token: body.token,
          p_platform: body.platform,
        });
    if (result.error)
      throw new DesignError(
        "Notifications couldn’t be saved. Try again later.",
        503,
      );
    return Response.json(
      { saved: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof DesignError
            ? e.message
            : "Notifications couldn’t be saved.",
      },
      {
        status: e instanceof DesignError ? e.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export const POST = (req: Request) => handle(req);
export const DELETE = (req: Request) => handle(req, true);
