// Read-only checks. Never starts AI generation or modifies customer data.
const url = process.env.BUILDLY_API_URL || "https://buildly-ecru.vercel.app";
let failed = false;
for (const path of [
  "/api/health",
  "/api/config",
  "/privacy",
  "/terms",
  "/support",
]) {
  try {
    const response = await fetch(new URL(path, url), {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    if (path === "/api/health") {
      const value = await response.json();
      if (
        value.version !== "non-payment-release-v1" ||
        !value.database ||
        value.status !== "ok"
      )
        throw Error("Backend release or database migration is not ready");
      console.log(`PASS ${path}: ${value.status}, release ${value.commit}`);
    } else if (path === "/api/config") {
      const value = await response.json();
      if (
        !value.supabaseUrl ||
        !value.supabasePublishableKey ||
        !value.aiConsentVersion ||
        !value.imageGenerationAvailable
      )
        throw Error("Public configuration is incomplete");
      console.log(
        `PASS ${path}: account and AI disclosure configuration present`,
      );
    } else console.log(`PASS ${path}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
