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
    return NextResponse.json(
      { credits: data?.balance || 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load purchases." },
      { status: e instanceof DesignError ? e.status : 500 },
    );
  }
}
