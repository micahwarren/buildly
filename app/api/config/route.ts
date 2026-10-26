import { imageProviderConfig } from "@/lib/image-provider";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    {
      imageGenerationAvailable: Boolean(imageProviderConfig().apiKey),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      supabasePublishableKey:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        null,
      billingEnabled: process.env.BILLING_ENABLED === "true",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
