import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/billing/server";
import { DesignError } from "@/lib/services/image-design";
export async function GET(req: Request) {
  try {
    if (process.env.BILLING_ENABLED !== "true")
      throw new DesignError("Project purchases are not available yet.", 503);
    const { db, user } = await authenticatedUser(req);
    const { data, error } = await db
      .from("buildly_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new DesignError("Purchase balance is unavailable.", 503);
    const receipts = await db
      .from("buildly_receipts")
      .select("transaction_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (receipts.error)
      throw new DesignError("Purchase history is unavailable.", 503);
    const projectId = new URL(req.url).searchParams.get("projectId");
    let access:
      | { projectAccess: boolean; revisions?: number; revoked?: boolean }
      | undefined;
    if (projectId) {
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(projectId))
        throw new DesignError("Open a saved project first.", 400);
      const owned = await db
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (owned.error)
        throw new DesignError("Project access is unavailable.", 503);
      if (!owned.data)
        throw new DesignError("This project was not found.", 404);
      const row = await db
        .from("buildly_project_access")
        .select("root_id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (row.error)
        throw new DesignError("Project access is unavailable.", 503);
      access = { projectAccess: false };
      if (row.data) {
        const root = await db
          .from("buildly_project_access")
          .select("revisions,purchase_transaction")
          .eq("id", row.data.root_id)
          .eq("user_id", user.id)
          .single();
        if (root.error)
          throw new DesignError("Project access is unavailable.", 503);
        let revoked = false;
        if (root.data.purchase_transaction) {
          const receipt = await db
            .from("buildly_receipts")
            .select("refunded")
            .eq("transaction_id", root.data.purchase_transaction)
            .eq("user_id", user.id)
            .single();
          if (receipt.error)
            throw new DesignError("Purchase access is unavailable.", 503);
          revoked = receipt.data.refunded;
        }
        access = {
          projectAccess: !revoked,
          revoked,
          revisions: root.data.revisions,
        };
      }
    }
    return NextResponse.json(
      {
        credits: data?.balance || 0,
        receiptCount: receipts.count || 0,
        ...access,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load purchases." },
      { status: e instanceof DesignError ? e.status : 500 },
    );
  }
}
