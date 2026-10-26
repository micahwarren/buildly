import { imageProviderConfig } from "@/lib/image-provider";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    {
      imageGenerationAvailable: Boolean(imageProviderConfig().apiKey),
      billingEnabled: process.env.BILLING_ENABLED === "true",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
