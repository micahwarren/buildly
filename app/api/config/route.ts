import { imageProviderConfig } from "@/lib/image-provider";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    { imageGenerationAvailable: Boolean(imageProviderConfig().apiKey) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
