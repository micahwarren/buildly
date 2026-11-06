import { deletePurchaseCustomer } from "@/lib/billing/delete-customer";
import { authenticatedUser } from "@/lib/billing/server";
import { requireRecentLogin } from "@/lib/production/access";
import { jobError } from "@/lib/production/errors";
import { DesignError } from "@/lib/services/image-design";
import { prepareAppleRevocation } from "@/lib/accounts/apple-revocation";
export const maxDuration = 120;
export async function DELETE(req: Request) {
  try {
    const { db, user } = await authenticatedUser(req);
    requireRecentLogin(user);
    const raw = await req.text();
    if (raw.length > 8192)
      throw new DesignError("Invalid deletion request.", 400);
    let body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new DesignError("Invalid deletion request.", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new DesignError("Invalid deletion request.", 400);
    const revokeApple = prepareAppleRevocation(
      user,
      body.appleAuthorizationCode,
    );
    const deletion = await db.rpc("buildly_begin_deletion", {
      p_user: user.id,
    });
    if (deletion.error) throw jobError(deletion.error.message);
    // Keep the auth account and deletion fence available for retry if provider cleanup fails.
    await revokeApple();
    await deletePurchaseCustomer(user.id);
    const bucket = db.storage.from("project-images");
    async function empty(prefix: string): Promise<void> {
      // Always delete page zero, so removing files cannot skip subsequent pages.
      for (;;) {
        const { data, error } = await bucket.list(prefix, { limit: 100 });
        if (error) throw error;
        if (!data?.length) return;
        const files: string[] = [];
        for (const item of data) {
          if (item.id) files.push(`${prefix}/${item.name}`);
          else await empty(`${prefix}/${item.name}`);
        }
        if (files.length) {
          const { error } = await bucket.remove(files);
          if (error) throw error;
        }
      }
    }
    await empty(user.id);
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return Response.json({ deleted: true });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof DesignError
            ? e.message
            : "Account deletion could not finish. Please retry.",
      },
      { status: e instanceof DesignError ? e.status : 503 },
    );
  }
}
