import { imageProviderConfig } from "@/lib/image-provider";
import { consentVersion } from "@/lib/production/access";
import { NextResponse } from "next/server";
import { projectProducts } from "@/lib/billing/products";
import { starterConfigured } from "@/lib/starter/device-check";
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
      billing: {
        starterTokensAvailable: starterConfigured(),
        products: projectProducts(process.env.REVENUECAT_PROJECT_PRODUCT_ID),
        productId:
          process.env.REVENUECAT_PROJECT_PRODUCT_ID ||
          "sightsaw.project.single",
        iosApiKey: process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY?.startsWith(
          "appl_",
        )
          ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
          : null,
        androidApiKey:
          process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY?.startsWith("goog_")
            ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY
            : null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
