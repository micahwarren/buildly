import regions from "./gemini-regions.json";
import { DesignError } from "../services/image-design";

const supportedCountries = new Set(regions.countryCodes);

/** Vercel supplies this country header at ingress; never use a body/profile location.
 * This production deployment is Vercel-hosted. No country/IP is stored in a job.
 * A worker continues a previously accepted job without pretending its own IP is
 * the client's country. Local development does not have Vercel's ingress header.
 */
export function requireProviderRegion(
  req: Request,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV !== "production" && env.VERCEL !== "1") return;
  const country = req.headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country) || country === "XX")
    throw new DesignError(
      "Your region could not be verified. Please try again before starting AI work.",
      503,
      "ai_region_unverified",
    );
  if (!supportedCountries.has(country))
    throw new DesignError(
      "AI features are not available in your region. Your saved projects and tokens are still available.",
      403,
      "ai_region_unavailable",
    );
}
