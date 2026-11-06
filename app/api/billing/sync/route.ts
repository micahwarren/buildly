import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/billing/server";
import { reconcilePurchases } from "@/lib/billing/reconcile";
import { DesignError } from "@/lib/services/image-design";
export async function POST(req: Request) {
  try {
    if (process.env.BILLING_ENABLED !== "true")
      throw new DesignError("Purchases are unavailable.", 503);
    const { db, user } = await authenticatedUser(req);
    const raw = await req.text();
    if (raw.length > 512) throw new DesignError("Invalid purchase check.", 400);
    let body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new DesignError("Invalid purchase check.", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new DesignError("Invalid purchase check.", 400);
    const transaction = body.transaction;
    if (
      transaction !== undefined &&
      (typeof transaction !== "string" ||
        !/^[A-Za-z0-9._:-]{1,200}$/.test(transaction))
    )
      throw new DesignError("Invalid purchase check.", 400);
    const recorded = await db
      .from("buildly_receipts")
      .select("transaction_id")
      .eq("user_id", user.id);
    if (recorded.error)
      throw new DesignError("Purchase history is unavailable.", 503);
    const matched = new Set<string>();
    const known = new Set((recorded.data || []).map((x) => x.transaction_id));
    // A caller may only recover their own verified purchases; the existing atomic
    // ledger deduplicates this path against webhook delivery, including refunds.
    await reconcilePurchases(user.id, async (receipt) => {
      if (
        transaction &&
        (receipt.providerId === transaction ||
          receipt.transaction.slice(receipt.transaction.indexOf(":") + 1) ===
            transaction)
      )
        matched.add(receipt.transaction);
      if (known.has(receipt.transaction)) return;
      const result = await db.rpc("buildly_purchase_pack", {
        p_user: user.id,
        p_transaction: receipt.transaction,
        p_units: receipt.credits,
        p_refund: false,
      });
      if (result.error?.message.includes("RECEIPT_RETIRED")) return;
      if (result.error)
        throw new DesignError(
          "Your purchase is saved. Balance update is still pending.",
          503,
        );
    });
    const [credits, receipts, proof] = await Promise.all([
      db
        .from("buildly_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("buildly_receipts")
        .select("transaction_id", { count: "exact", head: true })
        .or("transaction_id.like.PRODUCTION:%,transaction_id.like.SANDBOX:%")
        .eq("user_id", user.id),
      transaction
        ? db
            .from("buildly_receipts")
            .select("transaction_id")
            .eq("user_id", user.id)
            .eq("refunded", false)
            .in("transaction_id", [
              ...matched,
              `PRODUCTION:${transaction}`,
              `SANDBOX:${transaction}`,
            ])
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (credits.error || receipts.error)
      throw new DesignError(
        "Your balance could not load. Please check again.",
        503,
      );
    return NextResponse.json(
      {
        credits: credits.data?.balance || 0,
        receiptCount: receipts.count || 0,
        verified: !proof.error && !!proof.data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof DesignError
            ? e.message
            : "Purchase verification could not finish.",
      },
      {
        status: e instanceof DesignError ? e.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
