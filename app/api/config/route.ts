import { imageProviderConfig } from "@/lib/image-provider";
import { consentVersion } from "@/lib/production/access";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    {
      aiConsentVersion: `${consentVersion}:${imageProviderConfig().provider || "unavailable"}`,
      aiServices:
        imageProviderConfig().provider === "openai"
          ? "OpenAI for design images and Google Gemini for plans"
          : "Google Gemini for design images and plans",
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
